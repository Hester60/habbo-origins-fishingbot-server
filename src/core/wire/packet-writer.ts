import Base64Codec from './base64-codec.js';
import Vl64Codec from './vl64-codec.js';
import ShockwaveString from './shockwave-string.js';

/**
 * Fluent builder for an outbound packet: [2-byte b64 header][args, in
 * order]. Each arg method delegates to the encoding that owns that concept
 * (Base64Codec for the header, Vl64Codec for ints, ShockwaveString.write
 * for strings — outbound format only, never .read()). raw() bypasses all
 * encoding, for the handful of legacy ASCII tokens the protocol still
 * expects verbatim.
 */
export default class PacketWriter {
  private readonly chunks: Buffer[];

  constructor(header: number) {
    this.chunks = [Base64Codec.encodeInt(header, 2)];
  }

  int(value: number): this {
    this.chunks.push(Vl64Codec.encode(value));

    return this;
  }

  str(value: string): this {
    this.chunks.push(ShockwaveString.write(value));

    return this;
  }

  raw(value: string): this {
    this.chunks.push(Buffer.from(value, 'latin1'));

    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
