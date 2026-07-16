import Socket from '../interfaces/socket.js';
import * as net from 'node:net';

/**
 * Adapts Node's real net.Socket (event-based: 'data', 'error'...) to the
 * minimal Socket interface HabboConnection depends on. Pure translation,
 * no protocol logic — write() and onData() are the only two operations
 * HabboConnection ever needs from a transport.
 */
export default class NodeSocketAdapter implements Socket {
  constructor(private readonly socket: net.Socket) {
    //
  }

  write(data: Buffer): void {
    this.socket.write(data);
  }

  onData(callback: (data: Buffer) => void): void {
    this.socket.on('data', (data: Buffer) => callback(data));
  }
}
