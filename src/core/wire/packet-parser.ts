import Base64Codec from './base64-codec.js';
import { ParsedPacket } from '../../types.js';

/**
 * Splits an already-decrypted frame into its header and body — nothing
 * more. Doesn't know or care what's inside the body (ints, strings, raw
 * tokens); that's PacketReader's job, once this has isolated it.
 */
export default class PacketParser {
  static parse(frame: Buffer): ParsedPacket {
    if (frame.length < 2) {
      return { header: -1, body: frame };
    }

    const header: Buffer = frame.subarray(0, 2);

    return {
      header: Base64Codec.decodeInt(header),
      body: frame.subarray(2),
    };
  }
}
