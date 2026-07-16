import { describe, expect, it } from 'vitest';
import * as net from 'node:net';
import NodeSocketAdapter from '../../../src/core/net/node-socket-adapter.js';
import { startTestServer } from '../../test-helper.js';

describe('NodeSocketAdapter', () => {
  it('write() sends bytes that a real server actually receives', async () => {
    const { server, port } = await startTestServer();

    const received = new Promise<Buffer>((resolve) => {
      server.on('connection', (serverSocket) => {
        serverSocket.once('data', (data: Buffer) => resolve(data));
      });
    });

    const clientSocket = net.createConnection({ host: '127.0.0.1', port });
    await new Promise<void>((resolve) => clientSocket.once('connect', resolve));

    const adapter = new NodeSocketAdapter(clientSocket);
    adapter.write(Buffer.from('hello'));

    expect((await received).toString()).toBe('hello');

    clientSocket.destroy();
    server.close();
  });

  it('onData() fires with the exact bytes a real server sends back', async () => {
    const { server, port } = await startTestServer();

    server.on('connection', (serverSocket) => {
      serverSocket.write(Buffer.from('answer'));
    });

    const clientSocket = net.createConnection({ host: '127.0.0.1', port });
    await new Promise<void>((resolve) => clientSocket.once('connect', resolve));

    const adapter = new NodeSocketAdapter(clientSocket);

    const received = await new Promise<Buffer>((resolve) => {
      adapter.onData((data) => resolve(data));
    });

    expect(received.toString()).toBe('answer');

    clientSocket.destroy();
    server.close();
  });
});
