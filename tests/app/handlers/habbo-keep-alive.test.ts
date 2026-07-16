import { describe, expect, it } from 'vitest';
import HabboConnection from '../../../src/core/connection/habbo-connection.js';
import HabboKeepAlive from '../../../src/app/handlers/habbo-keep-alive.js';
import PacketParser from '../../../src/core/wire/packet-parser.js';
import {
  FakeSocket,
  buildInboundMessage,
  readOutboundString,
  makeDeps,
} from '../../test-helper.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';

describe('HabboKeepAlive', () => {
  it('responds to PING with PONG, echoing the same timestamp', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    new HabboKeepAlive(connection);

    const pingMessage = buildInboundMessage(IncomingHeaders.PING, '999888');
    socket.simulateReceive(Buffer.concat([pingMessage, Buffer.from([0x01])]));

    expect(socket.sent).toHaveLength(1);

    const frame = socket.sent[0];
    const packet = frame.subarray(3);
    const parsed = PacketParser.parse(packet);

    expect(parsed.header).toBe(OutgoingHeaders.PONG);

    const [zero, consumed] = readOutboundString(parsed.body, 0);
    const [timestamp] = readOutboundString(parsed.body, consumed);

    expect(zero).toBe('0');
    expect(timestamp).toBe('999888');
  });

  it('ignores any packet that is not PING', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    new HabboKeepAlive(connection);

    const helloMessage = buildInboundMessage(IncomingHeaders.HELLO);
    socket.simulateReceive(Buffer.concat([helloMessage, Buffer.from([0x01])]));

    expect(socket.sent).toHaveLength(0);
  });
});
