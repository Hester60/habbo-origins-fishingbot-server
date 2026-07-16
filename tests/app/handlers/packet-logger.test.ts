import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HabboConnection from '../../../src/core/connection/habbo-connection.js';
import PacketLogger from '../../../src/app/handlers/packet-logger.js';
import Base64Codec from '../../../src/core/wire/base64-codec.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';
import { FakeSocket, makeDeps } from '../../test-helper.js';

function inboundFrame(header: number): Buffer {
  return Buffer.concat([Base64Codec.encodeInt(header, 2), Buffer.from([0x01])]);
}

function setup() {
  const socket = new FakeSocket();
  const connection = new HabboConnection(makeDeps(socket));
  new PacketLogger(connection);

  return { socket, connection };
}

describe('PacketLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs the real header name for a known header (OK = 3)', () => {
    const { socket } = setup();

    socket.simulateReceive(inboundFrame(IncomingHeaders.OK));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('3');
    expect(loggedLine).toContain('OK');
  });

  it('does not confuse a known header with an unrelated one', () => {
    const { socket } = setup();

    socket.simulateReceive(inboundFrame(IncomingHeaders.OK));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).not.toContain('NO_LOGIN_PERMISSION');
  });

  it('resolves a header whose numeric value exceeds the number of known headers (BANNER = 277)', () => {
    const { socket } = setup();

    socket.simulateReceive(inboundFrame(IncomingHeaders.BANNER));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('277');
    expect(loggedLine).toContain('BANNER');
  });

  it('falls back to UNKNOWN for a header with no name in IncomingHeaders', () => {
    const { socket } = setup();

    socket.simulateReceive(inboundFrame(4095));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('4095');
    expect(loggedLine).toContain('UNKNOWN');
  });

  it('logs the real header name for a known outgoing header (ROOM_DIRECTORY = 2)', () => {
    const { connection } = setup();

    connection.send(Base64Codec.encodeInt(OutgoingHeaders.ROOM_DIRECTORY, 2));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('2');
    expect(loggedLine).toContain('ROOM_DIRECTORY');
  });

  it('does not confuse a known outgoing header with an unrelated one', () => {
    const { connection } = setup();

    connection.send(Base64Codec.encodeInt(OutgoingHeaders.ROOM_DIRECTORY, 2));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).not.toContain('LOGIN');
  });

  it('resolves an outgoing header whose numeric value exceeds the number of known headers (CLIENT_INIT = 206)', () => {
    const { connection } = setup();

    connection.send(Base64Codec.encodeInt(OutgoingHeaders.CLIENT_INIT, 2));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('206');
    expect(loggedLine).toContain('CLIENT_INIT');
  });

  it('falls back to UNKNOWN for an outgoing header with no name in OutgoingHeaders', () => {
    const { connection } = setup();

    connection.send(Base64Codec.encodeInt(4095, 2));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine).toContain('4095');
    expect(loggedLine).toContain('UNKNOWN');
  });

  it('tags incoming and outgoing log lines differently', () => {
    const { socket, connection } = setup();

    socket.simulateReceive(inboundFrame(IncomingHeaders.OK));
    connection.send(Base64Codec.encodeInt(OutgoingHeaders.ROOM_DIRECTORY, 2));

    expect(logSpy.mock.calls[0][0]).toContain('INCOMING');
    expect(logSpy.mock.calls[1][0]).toContain('OUTGOING');
  });

  it('prefixes log lines with the connection uuid, before the timestamp', () => {
    const { socket, connection } = setup();

    socket.simulateReceive(inboundFrame(IncomingHeaders.OK));

    const [loggedLine] = logSpy.mock.calls[0];
    expect(loggedLine.startsWith(`[${connection.uuid}]`)).toBe(true);
  });

  it('uses a different uuid prefix for two different connections', () => {
    const { socket: socketA, connection: connectionA } = setup();
    const { socket: socketB, connection: connectionB } = setup();

    socketA.simulateReceive(inboundFrame(IncomingHeaders.OK));
    socketB.simulateReceive(inboundFrame(IncomingHeaders.OK));

    expect(logSpy.mock.calls[0][0]).toContain(connectionA.uuid);
    expect(logSpy.mock.calls[1][0]).toContain(connectionB.uuid);
    expect(connectionA.uuid).not.toBe(connectionB.uuid);
  });
});
