import { describe, expect, it } from 'vitest';
import modPow from '../../../src/core/crypto/modPow.js';

describe('modPow', () => {
  it('computes G^privateKey mod P', () => {
    const G = 5n;
    const privateKey = 3n;
    const P = 7n;

    expect(modPow(G, privateKey, P)).toBe(6n);
  });

  it('computes another modular exponentiation', () => {
    expect(modPow(2n, 10n, 17n)).toBe(4n);
  });

  it('returns 1 when exponent is 0', () => {
    expect(modPow(42n, 0n, 13n)).toBe(1n);
  });
});
