import Base64Codec from './base64-codec.js';

/**
 * Encodes/decodes strings for the wire — but write() and read() are
 * intentionally NOT inverses of each other. The protocol uses a different
 * string format depending on direction: outbound strings (what you send)
 * are length-prefixed, inbound strings (what you receive) are terminated
 * by a 0x02 marker. Never chain write() into read() or vice versa.
 */
export default class ShockwaveString {
  static write(value: string): Buffer {
    const buffer: Buffer = Buffer.from(value, 'latin1');
    const length: Buffer = Base64Codec.encodeInt(buffer.length, 2);

    return Buffer.concat([length, Buffer.from(value, 'latin1')]);
  }

  static read(bytes: Buffer, pos?: number): [string, number] {
    const start: number = pos ? pos : 0;
    let count: number = 0;
    let ended: boolean = false;

    for (let i = 0; i < bytes.length; i++) {
      count++;

      if (bytes[i + start] === 0x02) {
        ended = true;
        break;
      }
    }

    const result: string = bytes
      .subarray(start, start + (ended ? count - 1 : count))
      .toString('latin1');

    return [result, count];
  }
}
