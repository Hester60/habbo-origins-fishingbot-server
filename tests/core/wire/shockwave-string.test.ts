import { describe, expect, it } from 'vitest';
import ShockwaveString from '../../../src/core/wire/shockwave-string.js';

describe('ShockwaveString', () => {
  it('write() length-prefixes the string', () => {
    expect(ShockwaveString.write('hi')).toEqual(Buffer.from([0x40, 0x42, 0x68, 0x69]));
  });

  it('read() stops at a 0x02 terminator, consuming it', () => {
    expect(ShockwaveString.read(Buffer.from('hello\x02world'), 0)).toEqual(['hello', 6]);
  });

  it('read() reads to the end of the buffer when no terminator is found', () => {
    expect(ShockwaveString.read(Buffer.from('plain'), 0)).toEqual(['plain', 5]);
  });

  it('read() starts at the given pos in the buffer', () => {
    expect(ShockwaveString.read(Buffer.from('XX' + 'hello\x02world'), 2)).toEqual(['hello', 6]);
  });
});
