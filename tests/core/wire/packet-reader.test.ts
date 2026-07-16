import { describe, expect, it } from 'vitest';
import PacketReader from '../../../src/core/wire/packet-reader.js';

describe('PacketReader', () => {
  it('reads int, then str, then remaining, advancing the cursor each time', () => {
    const body = Buffer.from([0x52, 0x4a, 0x6f, 0x6b, 0x02, 0x99]);
    const reader = new PacketReader(body);

    expect(reader.int()).toBe(42);
    expect(reader.str()).toBe('ok');
    expect(reader.remaining()).toEqual(Buffer.from([0x99]));
  });

  it('starts reading from a given pos, not always 0', () => {
    const body = Buffer.from([0x99, 0x99, 0x52, 0x4a, 0x6f, 0x6b, 0x02]);
    const reader = new PacketReader(body, 2);

    expect(reader.int()).toBe(42);
    expect(reader.str()).toBe('ok');
    expect(reader.remaining()).toEqual(Buffer.alloc(0));
  });

  it('remaining() returns everything left when called with nothing read yet', () => {
    const body = Buffer.from([0x01, 0x02, 0x03]);
    const reader = new PacketReader(body);

    expect(reader.remaining()).toEqual(body);
  });
});
