import { describe, expect, it } from 'vitest';
import GamedataPayloadBuilder from '../../../src/core/protocol/gamedata-payload-builder.js';

describe('GameDataPayloadBuilder', () => {
  it('matches the hand-verified 62-byte payload for version 330', () => {
    const url = 'http://origins-gamedata.habbo.com/external_variables/1';

    const payload = GamedataPayloadBuilder.build(url, 330);

    expect(payload).toEqual(
      Buffer.from([
        0x59, 0x5b, 0x44, 0x40, 0x41, 0x32, 0x40, 0x76, 0x68, 0x74, 0x74, 0x70, 0x3a, 0x2f, 0x2f,
        0x6f, 0x72, 0x69, 0x67, 0x69, 0x6e, 0x73, 0x2d, 0x67, 0x61, 0x6d, 0x65, 0x64, 0x61, 0x74,
        0x61, 0x2e, 0x68, 0x61, 0x62, 0x62, 0x6f, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x65, 0x78, 0x74,
        0x65, 0x72, 0x6e, 0x61, 0x6c, 0x5f, 0x76, 0x61, 0x72, 0x69, 0x61, 0x62, 0x6c, 0x65, 0x73,
        0x2f, 0x31,
      ]),
    );
  });

  it('changing the version only changes the first bytes (the VL64 part)', () => {
    const url = 'http://origins-gamedata.habbo.com/external_variables/1';

    const payload330 = GamedataPayloadBuilder.build(url, 330);
    const payload331 = GamedataPayloadBuilder.build(url, 331);

    expect(payload330.subarray(3)).toEqual(payload331.subarray(3));
    expect(payload330.subarray(0, 3)).not.toEqual(payload331.subarray(0, 3));
  });
});
