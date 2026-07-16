import ChachaCipher from '../crypto/chacha-cipher.js';
import Base64Codec from '../wire/base64-codec.js';
import PlainTextFrameReader from './plaintext-frame-reader.js';

/**
 * Inverse of EncryptedFrameWriter: reassembles encrypted chunks off the
 * wire back into individual plaintext messages. A chunk's own length isn't
 * known until its 6-char header is decrypted — so state (buffer,
 * pendingLength) has to survive across push() calls, exactly like
 * PlainTextFrameReader but with a decryption step in front. The header
 * cipher only ever advances ONCE per chunk (not per message inside it),
 * since a single decrypted chunk can bundle several 0x01-terminated
 * messages — that's what the inner PlainTextFrameReader is for.
 */
export default class EncryptedFrameReader {
  private buffer: Buffer = Buffer.alloc(0);
  private pendingLength: number | null = null;
  private readonly plaintext = new PlainTextFrameReader();

  constructor(
    private readonly headerCipher: ChachaCipher,
    private readonly dataCipher: ChachaCipher,
  ) {
    //
  }

  push(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  read(): Buffer[] {
    for (;;) {
      if (this.pendingLength === null) {
        if (this.buffer.length < 6) break;

        const decryptedHeader = this.headerCipher.apply(
          Base64Codec.decodeBytes(this.buffer.subarray(0, 6)),
        );
        if (decryptedHeader.length < 4) break;

        this.pendingLength = Base64Codec.decodeInt(decryptedHeader.subarray(1, 4));
      }

      if (this.pendingLength < 0 || this.buffer.length < 6 + this.pendingLength) break;

      const encodedPayload = this.buffer.subarray(6, 6 + this.pendingLength);
      this.buffer = this.buffer.subarray(6 + this.pendingLength);
      this.pendingLength = null;

      this.plaintext.push(this.dataCipher.apply(Base64Codec.decodeBytes(encodedPayload)));
    }

    return this.plaintext.read();
  }
}
