import { describe, expect, it } from 'vitest';
import DiffieHellman from '../../../src/core/crypto/diffie-hellman.js';

describe('diffie-hellman', () => {
  it('Share the same secret', () => {
    const aliceDiffieHellman = new DiffieHellman();
    const bobDiffieHellman = new DiffieHellman();

    const aliceSecretBigInt = aliceDiffieHellman.computeSharedSecret(bobDiffieHellman.publicKey);
    const bobSecretBigInt = bobDiffieHellman.computeSharedSecret(aliceDiffieHellman.publicKey);

    const aliceSecretBytes = aliceDiffieHellman.computeSharedSecretBytes(
      bobDiffieHellman.publicKey,
    );
    const bobSecretBytes = bobDiffieHellman.computeSharedSecretBytes(aliceDiffieHellman.publicKey);

    expect(aliceSecretBigInt).toEqual(bobSecretBigInt);
    expect(aliceSecretBytes).toEqual(bobSecretBytes);
  });

  it('private key never returns 0 and must be different from another one', () => {
    const key1 = DiffieHellman.generatePrivateKey();
    const key2 = DiffieHellman.generatePrivateKey();

    expect(key1).not.toEqual(0n);
    expect(key2).not.toEqual(0n);
    expect(key1).not.toEqual(key2);
  });

  it('publicKey is deterministic for a given private key', () => {
    const privateKey = 123456789n;

    const aliceDiffieHellman = new DiffieHellman(privateKey);
    const bobDiffieHellman = new DiffieHellman(privateKey);

    expect(aliceDiffieHellman.publicKey).toEqual(bobDiffieHellman.publicKey);
  });
});
