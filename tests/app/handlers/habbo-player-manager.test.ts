import { describe, expect, it } from 'vitest';
import HabboPlayerManager from '../../../src/app/handlers/habbo-player-manager.js';
import EventBus from '../../../src/app/handlers/event-bus.js';
import PacketParser from '../../../src/core/wire/packet-parser.js';
import PacketReader from '../../../src/core/wire/packet-reader.js';
import EncryptedFrameWriter from '../../../src/core/net/encrypted-frame-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';
import {
  FakeSocket,
  makeCiphers,
  decryptOutboundChunk,
  readyConnection,
  inbound,
} from '../../test-helper.js';
import { Events } from '../../../src/types.js';

describe('HabboPlayerManager', () => {
  it('move() sends MOVE(x, y, 0)', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const playerManager = new HabboPlayerManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    playerManager.move(12, 7);

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.MOVE);

    const reader = new PacketReader(packet.body);
    expect([reader.int(), reader.int(), reader.int()]).toEqual([12, 7, 0]);
  });

  it('startFishing() sends START_FISHING(fishId)', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const playerManager = new HabboPlayerManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    playerManager.startFishing(1005);

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.START_FISHING);

    const reader = new PacketReader(packet.body);
    expect(reader.int()).toBe(1005);
  });

  it('requestFishingStats() sends GET_FISHING_STATS()', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const playerManager = new HabboPlayerManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    playerManager.requestFishingStats();

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.GET_FISHING_STATS);
    expect(packet.body).toHaveLength(0);
  });

  it('emits FISH_CAUGHT_MSG with the parsed fields when FISHING_CHAT arrives', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPlayerManager(connection, eventBus);
    const ciphers = makeCiphers();

    let received: [number, string, number] | undefined;
    eventBus.on('FISH_CAUGHT_MSG', (userId, chatMsg, iconID) => {
      received = [userId, chatMsg, iconID];
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.FISHING_CHAT, 44, 'You caught a Crappie! (+47 XP)', 1),
      ),
    );

    expect(received).toEqual([44, 'You caught a Crappie! (+47 XP)', 1]);
  });
});
