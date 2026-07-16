import { describe, expect, it } from 'vitest';
import PlainTextFrameReader from '../../../src/core/net/plaintext-frame-reader.js';

describe('PlainTextFrameReader', () => {
  it('extracts complete messages and keeps the incomplete tail across pushes', () => {
    const reader = new PlainTextFrameReader();

    reader.push(Buffer.from('AB\x01CD\x01E', 'latin1'));
    expect(reader.read().map((b) => b.toString('latin1'))).toEqual(['AB', 'CD']);

    reader.push(Buffer.from('F\x01', 'latin1'));
    expect(reader.read().map((b) => b.toString('latin1'))).toEqual(['EF']);
  });

  it('returns an empty array when called twice with no new push in between', () => {
    const reader = new PlainTextFrameReader();
    reader.push(Buffer.from('AB\x01', 'latin1'));

    expect(reader.read().map((b) => b.toString('latin1'))).toEqual(['AB']);
    expect(reader.read()).toEqual([]);
  });

  it('gives the same result regardless of how the data is chunked', () => {
    const whole = new PlainTextFrameReader();
    whole.push(Buffer.from('AB\x01CD\x01', 'latin1'));

    const byteByByte = new PlainTextFrameReader();
    for (const byte of Buffer.from('AB\x01CD\x01', 'latin1')) {
      byteByByte.push(Buffer.from([byte]));
    }

    const wholeResult = whole.read().map((b) => b.toString('latin1'));
    const fragmentedResult = byteByByte.read().map((b) => b.toString('latin1'));

    expect(fragmentedResult).toEqual(wholeResult);
    expect(fragmentedResult).toEqual(['AB', 'CD']);
  });
});
