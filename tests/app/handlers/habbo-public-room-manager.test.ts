import { describe, expect, it } from 'vitest';
import HabboConnection from '../../../src/core/connection/habbo-connection.js';
import HabboPublicRoomManager from '../../../src/app/handlers/habbo-public-room-manager.js';
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
  makeDeps,
} from '../../test-helper.js';
import { ActiveRoomObject, Events } from '../../../src/types.js';

describe('HabboPublicRoomManager', () => {
  it('moveToRoom() sends ROOM_DIRECTORY(1, flatId, 0) once logged in and encrypted', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    navigator.moveToRoom(26);

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.ROOM_DIRECTORY);

    const reader = new PacketReader(packet.body);
    expect([reader.int(), reader.int(), reader.int()]).toEqual([1, 26, 0]);
  });

  it('moveToRoom() is a no-op before the connection is logged in', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());

    navigator.moveToRoom(26);

    expect(socket.sent).toHaveLength(0);
  });

  it('emits ROOM_ENTERED with the flatId when ROOM_READY matches the last request', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    const navigator = new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let entered: number | undefined;
    eventBus.on('ROOM_ENTERED', (flatId) => {
      entered = flatId;
    });

    navigator.moveToRoom(26);
    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));

    expect(entered).toBe(26);
  });

  it('ignores a ROOM_READY whose flatId does not match the last request', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    const navigator = new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let fired = false;
    eventBus.on('ROOM_ENTERED', () => {
      fired = true;
    });

    navigator.moveToRoom(26);
    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 99')));

    expect(fired).toBe(false);
  });

  it('ignores a ROOM_READY when no room was ever requested', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let fired = false;
    eventBus.on('ROOM_ENTERED', () => {
      fired = true;
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));

    expect(fired).toBe(false);
  });

  it('does not fire twice for a duplicate ROOM_READY after the request was already matched', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    const navigator = new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let fireCount = 0;
    eventBus.on('ROOM_ENTERED', () => {
      fireCount++;
    });

    navigator.moveToRoom(26);
    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    const frame = inbound(IncomingHeaders.ROOM_READY, 'model_a 26');
    socket.simulateReceive(serverWriter.encode(frame, Buffer.from([0x11])));
    socket.simulateReceive(serverWriter.encode(frame, Buffer.from([0x22])));

    expect(fireCount).toBe(1);
  });

  it('isRoomEntered() reflects confirmed room entry, and resets on a new moveToRoom()', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    expect(navigator.isRoomEntered()).toBe(false);

    navigator.moveToRoom(26);
    expect(navigator.isRoomEntered()).toBe(false);

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));
    expect(navigator.isRoomEntered()).toBe(true);

    navigator.moveToRoom(99);
    expect(navigator.isRoomEntered()).toBe(false);
  });

  it('requestHeightmap() is a no-op before any room has been confirmed entered', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());

    navigator.moveToRoom(26);
    navigator.requestHeightmap();

    expect(socket.sent).toHaveLength(1);
  });

  it('requestHeightmap() sends G_HMAP once the requested room has been confirmed entered', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    navigator.moveToRoom(26);
    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));

    navigator.requestHeightmap();

    expect(socket.sent).toHaveLength(2);
    decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const decrypted = decryptOutboundChunk(socket.sent[1], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.G_HMAP);
    expect(packet.body).toHaveLength(0);
  });

  it('requestHeightmap() is blocked again after a new moveToRoom() call resets the entered state', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const navigator = new HabboPublicRoomManager(connection, new EventBus<Events>());
    const ciphers = makeCiphers();

    navigator.moveToRoom(26);
    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));

    navigator.moveToRoom(99);
    navigator.requestHeightmap();

    expect(socket.sent).toHaveLength(2);
  });

  it('emits HEIGHTMAP_RECEIVED with the body split into rows when HEIGHTMAP arrives', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let received: string[] | undefined;
    eventBus.on('HEIGHTMAP_RECEIVED', (rows) => {
      received = rows;
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.HEIGHTMAP, 'xxxx\r0000\rxxxx')),
    );

    expect(received).toEqual(['xxxx', '0000', 'xxxx']);
  });

  it('emits ACTIVE_OBJECT_ADDED with the parsed object and the updated list when ACTIVE_OBJECT_ADD arrives', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let received: [ActiveRoomObject, readonly ActiveRoomObject[]] | undefined;
    eventBus.on('ACTIVE_OBJECT_ADDED', (obj, list) => {
      received = [obj, list];
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );

    expect(received?.[0]).toEqual({ id: '1001', owner: -1, className: 'fish_sign', x: 28, y: 16 });
    expect(received?.[1]).toEqual([
      { id: '1001', owner: -1, className: 'fish_sign', x: 28, y: 16 },
    ]);
  });

  it('accumulates several ACTIVE_OBJECT_ADD into the emitted list, in order', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    const lists: (readonly ActiveRoomObject[])[] = [];
    eventBus.on('ACTIVE_OBJECT_ADDED', (_obj, list) => {
      lists.push(list);
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1002', -1, 'fish_area', 30, 18),
      ),
    );

    expect(lists[0]).toHaveLength(1);
    expect(lists[1]).toHaveLength(2);
    expect(lists[1].map((o) => o.id)).toEqual(['1001', '1002']);
  });

  it('emits a defensive copy: mutating a previously received list does not affect the next emission', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    const lists: (readonly ActiveRoomObject[])[] = [];
    eventBus.on('ACTIVE_OBJECT_ADDED', (_obj, list) => {
      lists.push(list);
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );
    (lists[0] as ActiveRoomObject[]).push({
      id: 'intrus',
      owner: -1,
      className: 'fake',
      x: 0,
      y: 0,
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1002', -1, 'fish_area', 30, 18),
      ),
    );

    expect(lists[1]).toHaveLength(2);
    expect(lists[1].map((o) => o.id)).toEqual(['1001', '1002']);
  });

  it('clears the active object list on every ROOM_READY, matched or not', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    const manager = new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    const lists: (readonly ActiveRoomObject[])[] = [];
    eventBus.on('ACTIVE_OBJECT_ADDED', (_obj, list) => {
      lists.push(list);
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );

    manager.moveToRoom(26);
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_a 26')));
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1002', -1, 'fish_area', 30, 18),
      ),
    );

    expect(lists[1]).toHaveLength(1);
    expect(lists[1][0].id).toBe('1002');
  });

  it('emits ACTIVE_OBJECT_REMOVED with the removed object and the updated list when ACTIVE_OBJECT_REMOVE matches', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let received: [ActiveRoomObject, readonly ActiveRoomObject[]] | undefined;
    eventBus.on('ACTIVE_OBJECT_REMOVED', (obj, list) => {
      received = [obj, list];
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1002', -1, 'fish_area', 30, 18),
      ),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.ACTIVE_OBJECT_REMOVE, '1001')),
    );

    expect(received?.[0]).toEqual({ id: '1001', owner: -1, className: 'fish_sign', x: 28, y: 16 });
    expect(received?.[1]).toEqual([
      { id: '1002', owner: -1, className: 'fish_area', x: 30, y: 18 },
    ]);
  });

  it('does not emit ACTIVE_OBJECT_REMOVED for an id that was never tracked', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    let fired = false;
    eventBus.on('ACTIVE_OBJECT_REMOVED', () => {
      fired = true;
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.ACTIVE_OBJECT_REMOVE, '9999')),
    );

    expect(fired).toBe(false);
  });

  it('a removed object no longer appears in a subsequent ACTIVE_OBJECT_ADDED list', () => {
    const socket = new FakeSocket();
    const connection = readyConnection(socket);
    const eventBus = new EventBus<Events>();
    new HabboPublicRoomManager(connection, eventBus);
    const ciphers = makeCiphers();

    const lists: (readonly ActiveRoomObject[])[] = [];
    eventBus.on('ACTIVE_OBJECT_ADDED', (_obj, list) => {
      lists.push(list);
    });

    const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1001', -1, 'fish_sign', 28, 16),
      ),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.ACTIVE_OBJECT_REMOVE, '1001')),
    );
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.ACTIVE_OBJECT_ADD, '1002', -1, 'fish_area', 30, 18),
      ),
    );

    expect(lists[1]).toEqual([{ id: '1002', owner: -1, className: 'fish_area', x: 30, y: 18 }]);
  });
});
