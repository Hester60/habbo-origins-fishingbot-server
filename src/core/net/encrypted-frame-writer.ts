import ChachaCipher from '../crypto/chacha-cipher.js';
import Base64Codec from '../wire/base64-codec.js';
import { randomBytes } from 'crypto';

/**
 * Builds one outbound encrypted frame: [6-char b64 header][b64 ciphertext
 * payload]. The header (1 random padding byte + 3-byte payload length) is
 * encrypted with its own ChaChaCipher stream, separate from the payload's
 * — two independent counters, one per direction's channel pair (see
 * BobbaKeyDerivation). The padding byte has no effect on correctness
 * (decode works with any value); it's a parameter with a random default so
 * production gets real randomness while tests can pin it down for a
 * reproducible expected output.
 */
export default class EncryptedFrameWriter {
  constructor(
    private readonly headerCipher: ChachaCipher,
    private readonly dataCipher: ChachaCipher,
  ) {
    //
  }

  encode(packet: Buffer, randomByte: Buffer = randomBytes(1)): Buffer {
    const encryptedPacket: Buffer = this.dataCipher.apply(packet);
    const encodedPacket: Buffer = Base64Codec.encodeBytes(encryptedPacket);
    const packetLength: Buffer = Base64Codec.encodeInt(encodedPacket.length, 3);

    const header: Buffer = Buffer.from([...randomByte, ...packetLength]);
    const encryptedHeader: Buffer = this.headerCipher.apply(header);
    const encodedHeader: Buffer = Base64Codec.encodeBytes(encryptedHeader);

    return Buffer.concat([encodedHeader, encodedPacket]);
  }
}
