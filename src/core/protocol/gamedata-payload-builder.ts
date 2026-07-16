import Vl64Codec from '../wire/vl64-codec.js';
import ShockwaveString from '../wire/shockwave-string.js';

/**
 * Builds the raw GAMEDATA payload (header 5) — the only field the server
 * actually checks is the version (VL64-encoded, offset by 803, empirically
 * measured against the real server). The "2" and the URL are constant
 * pieces of the format, encoded the same way as any other outbound string.
 * Sent as-is, raw (PacketWriter.raw(...)), never through .str() — it's not
 * length-prefixed as a whole like a normal outbound string would be.
 */
export default class GamedataPayloadBuilder {
  static build(gamedataUrl: string, version: number): Buffer {
    return Buffer.concat([
      Vl64Codec.encode(version + 803),
      ShockwaveString.write('2'),
      ShockwaveString.write(gamedataUrl),
    ]);
  }
}
