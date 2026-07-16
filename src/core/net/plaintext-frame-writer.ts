import Base64Codec from '../wire/base64-codec.js';

/**
 * Outbound plaintext framing: length-prefixed, never delimited — the
 * mirror of PlainTextFrameReader's 0x01 convention, but for what we send.
 */
export default class PlaintextFrameWriter {
  static encode(packet: Buffer): Buffer {
    const length: Buffer = Base64Codec.encodeInt(packet.length, 3);

    return Buffer.concat([length, packet]);
  }
}
