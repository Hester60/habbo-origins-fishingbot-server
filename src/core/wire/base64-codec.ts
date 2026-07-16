/**
 * Fixed-width and base64 byte encoding for the wire format.
 *
 * encodeInt/decodeInt: fixed-width integer encoding for structural fields
 * whose position and size are always known in advance by both sides — packet
 * headers (width=2) and, later, frame lengths (width=3). Unlike Vl64Codec
 * (which self-describes its own length in-band), there's nothing to detect
 * here: the caller always knows exactly how many characters this field
 * occupies. Each output byte carries 6 bits of the value, most-significant
 * group first, offset by 0x40 so every byte stays printable (0x40-0x7F) and
 * can never collide with a protocol delimiter (0x01 frame end, 0x02 string
 * end).
 *
 * encodeBytes/decodeBytes: encodes raw bytes (typically already-encrypted
 * ChaCha20 output) into standard base64 text, safe to embed in a wire frame.
 * The trailing '=' padding is stripped on encode: it only exists to round
 * base64 output to a multiple of 4 characters and carries no information,
 * so decodeBytes doesn't need it back to work.
 */
export default class Base64Codec {
  static encodeInt(value: number, width: number): Buffer {
    const buffer: Buffer = Buffer.alloc(width);
    let remaining: number = value;

    // Built least-significant group first (easiest to peel off with & 0x3F),
    // then flipped into the expected most-significant-first wire order.
    for (let i = 0; i < width; i++) {
      buffer[i] = (remaining & 0x3f) | 0x40;
      remaining >>= 6;
    }

    return buffer.reverse();
  }

  static decodeInt(bytes: Buffer): number {
    // Reversed so index 0 is the least-significant group, matching the
    // increasing left-shift below (i * 6).
    const buffer = Buffer.from(bytes).reverse();
    let result: number = 0;

    for (let i = 0; i < buffer.length; i++) {
      let bits: number = buffer[i] & 0x3f; // strip the 0x40 offset
      bits = bits << (i * 6);

      result = result | bits;
    }

    return result;
  }

  static encodeBytes(data: Buffer): Buffer {
    const b64 = data.toString('base64');

    // Buffer → string → Buffer round-trip here doesn't touch any byte value:
    // base64 output is always printable ASCII, so latin1 is just a type
    // conversion to satisfy Buffer.from's signature, not a real re-encoding.
    return Buffer.from(b64.replace(/=+$/, ''), 'latin1');
  }

  static decodeBytes(b64: Buffer): Buffer {
    // b64's bytes are already the ASCII characters of the base64 text; this
    // first toString('latin1') is only a Buffer → string type conversion
    // (Buffer.from's second argument requires a string), not a real decode.
    // The actual base64 → raw-bytes conversion happens only in Buffer.from(..., 'base64').
    return Buffer.from(b64.toString('latin1'), 'base64');
  }
}
