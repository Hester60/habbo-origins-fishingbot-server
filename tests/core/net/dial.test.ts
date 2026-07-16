import { describe, expect, it } from 'vitest';
import dial from '../../../src/core/net/dial.js';
import { startTestServer } from '../../test-helper.js';

describe('dial', () => {
  it('resolves with a functional Socket once connected to a real listening server', async () => {
    const { server, port } = await startTestServer();

    const received = new Promise<Buffer>((resolve) => {
      server.on('connection', (serverSocket) => {
        serverSocket.once('data', (data: Buffer) => resolve(data));
      });
    });

    const socket = await dial('127.0.0.1', port);
    socket.write(Buffer.from('salut'));

    expect((await received).toString()).toBe('salut');

    server.close();
  });

  it('rejects when nothing is listening on the port', async () => {
    const { server, port } = await startTestServer();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    await expect(dial('127.0.0.1', port, 300)).rejects.toThrow();
  });
});
