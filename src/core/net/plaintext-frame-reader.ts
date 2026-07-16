/**
 * Inbound plaintext stream: frames are delimited by 0x01.
 * Holds a partial tail across pushes, since TCP can hand
 * over a message cut off in the middle at any
 * point — read() only ever returns frames that are actually complete.
 */
export default class PlainTextFrameReader {
  private buffer: Buffer = Buffer.alloc(0);

  push(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  read(): Buffer[] {
    const messages: Buffer[] = [];
    let start = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i] === 0x01) {
        messages.push(this.buffer.subarray(start, i));
        start = i + 1;
      }
    }

    this.buffer = this.buffer.subarray(start);

    return messages;
  }
}
