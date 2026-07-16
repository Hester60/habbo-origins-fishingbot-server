import { describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import ChachaCipher from '../../../src/core/crypto/chacha-cipher.js';

describe('ChaChaCipher', () => {
  it('is deterministic given the same key/baseNonce/counter', () => {
    const key = randomBytes(32);
    const baseNonce = randomBytes(12);
    const data = randomBytes(16);

    const cipherA = new ChachaCipher(key, baseNonce);
    const cipherB = new ChachaCipher(key, baseNonce);

    expect(cipherA.apply(data)).toEqual(cipherB.apply(data));
  });

  it('advances its internal counter, so two calls on the same instance differ', () => {
    const key = randomBytes(32);
    const baseNonce = randomBytes(12);
    const data = randomBytes(16);

    const cipher = new ChachaCipher(key, baseNonce);

    const first = cipher.apply(data);
    const second = cipher.apply(data);

    expect(first).not.toEqual(second);
  });

  it('round-trips: encrypting then decrypting with a fresh matching instance returns the original data', () => {
    const key = randomBytes(32);
    const baseNonce = randomBytes(12);
    const plaintext = randomBytes(16);

    const encryptor = new ChachaCipher(key, baseNonce);
    const decryptor = new ChachaCipher(key, baseNonce);

    const ciphertext = encryptor.apply(plaintext);
    const decrypted = decryptor.apply(ciphertext);

    expect(decrypted).toEqual(plaintext);
  });
});
