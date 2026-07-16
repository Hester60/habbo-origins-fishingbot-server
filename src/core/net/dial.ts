import Socket from '../interfaces/socket.js';
import * as net from 'node:net';
import NodeSocketAdapter from './node-socket-adapter.js';

/**
 * Opens a real TCP connection and resolves only once actually connected,
 * wrapped in a NodeSocketAdapter — callers never see the raw net.Socket.
 * Generic networking plumbing, no knowledge of the Habbo protocol.
 *
 * The timeout guards against a dead IP that neither connects nor errors —
 * without it, the returned promise could hang forever.
 */
export default function dial(
  host: string,
  port: number,
  timeoutMs: number = 5000,
): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const clientSocket: net.Socket = net.createConnection({ host, port });

    const to = setTimeout(() => {
      clientSocket.destroy();
      reject(new Error('Connection timeout'));
    }, timeoutMs);

    clientSocket.once('connect', () => {
      clearTimeout(to);
      resolve(new NodeSocketAdapter(clientSocket));
    });

    clientSocket.once('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
  });
}
