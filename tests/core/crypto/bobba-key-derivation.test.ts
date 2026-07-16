import { describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import BobbaKeyDerivation from '../../../src/core/crypto/bobba-key-derivation.js';

describe('BobbaKeyDerivation', () => {
  it('is deterministic: same sharedSecret produces channels that encrypt identically', () => {
    const sharedSecret = randomBytes(32);
    const data = randomBytes(16);

    const derivedA = BobbaKeyDerivation.derive(sharedSecret);
    const derivedB = BobbaKeyDerivation.derive(sharedSecret);

    expect(derivedA.c2sData.apply(data)).toEqual(derivedB.c2sData.apply(data));
  });

  it('derives 4 cryptographically independent channels', () => {
    const sharedSecret = randomBytes(32);
    const data = randomBytes(16);

    const derived = BobbaKeyDerivation.derive(sharedSecret);

    const results = [
      derived.c2sData.apply(data),
      derived.c2sHeader.apply(data),
      derived.s2cData.apply(data),
      derived.s2cHeader.apply(data),
    ];

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i]).not.toEqual(results[j]);
      }
    }
  });
});
