import Vl64Codec from './vl64-codec.js';
import ShockwaveString from './shockwave-string.js';

/**
 * Sequential cursor over an already-parsed packet body (no header — that's
 * PacketParser's job, done once, before this exists). Doesn't know what
 * type comes next: the caller must already know the field order for a
 * given header (from the headers table, or reverse-engineered) and call
 * int()/str()/remaining() in that exact sequence. Each read delegates to
 * the matching decoder (Vl64Codec, ShockwaveString) and advances the
 * internal cursor by however many bytes it reports consuming.
 */
export default class PacketReader {
  private pos: number;

  constructor(
    private readonly body: Buffer,
    pos?: number,
  ) {
    this.pos = pos ? pos : 0;
  }

  int(): number {
    const decoded: [number, number] = Vl64Codec.decode(this.body, this.pos);

    this.pos += decoded[1];

    return decoded[0];
  }

  str(): string {
    const decoded: [string, number] = ShockwaveString.read(this.body, this.pos);

    this.pos += decoded[1];

    return decoded[0];
  }

  remaining(): Buffer {
    return this.body.subarray(this.pos);
  }
}
