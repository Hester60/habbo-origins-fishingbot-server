import { createCipheriv } from 'crypto';

/**
 * One direction/channel of the ChaCha20 stream. Doesn't know or care where
 * key/baseNonce come from (see BobbaKeyDerivation) — just wraps Node's
 * createCipheriv correctly around them.
 *
 * ChaCha20 encryption is XOR against a keystream, and XOR is its own
 * inverse, so apply() serves as both encrypt and decrypt: call it on
 * plaintext to get ciphertext, or on ciphertext (with matching key/nonce/
 * counter state) to get plaintext back.
 *
 * key/baseNonce/counter alone would repeat the exact same keystream for
 * every packet, which is a known ChaCha20 break (XOR-ing two ciphertexts
 * encrypted under the same keystream leaks both plaintexts). To avoid that
 * without renegotiating a key per packet, this class folds an internal,
 * ever-incrementing packet counter into the last 8 bytes of a *copy* of
 * baseNonce (little-endian) before every call, so each packet gets a
 * distinct 16-byte IV: 4 zero bytes (ChaCha20's own internal block counter,
 * left untouched) followed by that 12-byte adjusted nonce.
 */
export default class ChachaCipher {
  constructor(
    private readonly key: Buffer,
    private readonly baseNonce: Buffer,
    private counter: bigint = 0n,
  ) {
    //
  }

  apply(data: Buffer): Buffer {
    const baseNonceCopy = Buffer.from(this.baseNonce);

    const offset = baseNonceCopy.length - 8;
    const value = baseNonceCopy.readBigUInt64LE(offset);

    baseNonceCopy.writeBigUInt64LE(value + this.counter, offset);
    this.counter += 1n;

    const iv = Buffer.concat([Buffer.alloc(4), baseNonceCopy]);

    const cipher = createCipheriv('chacha20', this.key, iv);

    return Buffer.concat([cipher.update(data), cipher.final()]);
  }
}
