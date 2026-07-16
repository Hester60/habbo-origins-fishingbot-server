import { describe, expect, it } from 'vitest';
import HabboUsersManager from '../../../src/app/handlers/habbo-users-manager.js';
import EventBus from '../../../src/app/handlers/event-bus.js';
import PacketParser from '../../../src/core/wire/packet-parser.js';
import EncryptedFrameWriter from '../../../src/core/net/encrypted-frame-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';
import {
  FakeSocket,
  makeCiphers,
  decryptOutboundChunk,
  readyConnection,
  inbound,
} from '../../test-helper.js';
import { Events, OwnUserInfo, RoomUser, Status } from '../../../src/types.js';
import Base64Codec from '../../../src/core/wire/base64-codec.js';

function inboundUserLoggedOut(id: number): Buffer {
  return Buffer.concat([
    Base64Codec.encodeInt(IncomingHeaders.USER_LOGGED_OUT, 2),
    Buffer.from(String(id), 'latin1'),
    Buffer.from([0x01]),
  ]);
}

function setup() {
  const socket = new FakeSocket();
  const connection = readyConnection(socket);
  const eventBus = new EventBus<Events>();
  const usersManager = new HabboUsersManager(connection, eventBus);
  const ciphers = makeCiphers();
  const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);

  return { socket, connection, eventBus, usersManager, ciphers, serverWriter };
}

function userTypeOneFields(): (number | string)[] {
  return [
    74,
    215415,
    'toto60',
    'hd-180-1022.ch-230-62',
    'm',
    'Fishing expert',
    2,
    15,
    '0.0',
    '',
    'FSH',
    1,
    'std',
    'crr.216',
    4,
    0,
    0,
  ];
}

function normanUsersFields(): (number | string)[] {
  return [
    79,
    232829,
    'Mr.Norman',
    'hr-829-1143',
    'm',
    'Oldest Habbo.fr hotel manager',
    2,
    15,
    '0.0',
    '',
    'BLN',
    1,
    'std',
    'crr.73',
    4,
    0,
    80,
  ];
}

function ownInfoFields(): (number | string)[] {
  return [
    232829,
    'Mr.Norman',
    'hr-829-1143',
    'm',
    'Oldest Habbo.fr hotel manager',
    0,
    '',
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
  ];
}

describe('HabboUsersManager', () => {
  it('requestUsers() sends G_USRS with an empty body', () => {
    const { socket, usersManager, ciphers } = setup();

    usersManager.requestUsers();

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.G_USRS);
    expect(packet.body).toHaveLength(0);
  });

  it('emits STATUS_UPDATED with the parsed fields when STATUS arrives', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly Status[] | undefined;
    eventBus.on('STATUS_UPDATED', (status) => {
      received = status;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 2, 4, 'mv 10,5,0')),
    );

    expect(received).toEqual([
      { id: 44, x: 10, y: 5, height: 2.5, dirHead: 2, dirBody: 4, actions: ['mv 10,5,0'] },
    ]);
  });

  it('parses several users from a single STATUS packet, in order', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly Status[] | undefined;
    eventBus.on('STATUS_UPDATED', (status) => {
      received = status;
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.STATUS, 2, 44, 10, 5, '2.5', 0, 0, '', 1, 20, 15, '1.0', 0, 0, ''),
      ),
    );

    expect(received?.map((s) => s.id)).toEqual([44, 1]);
  });

  it('splits multiple simultaneous actions on "/" and ignores empty segments', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly Status[] | undefined;
    eventBus.on('STATUS_UPDATED', (status) => {
      received = status;
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, 'mv 10,5,0/sit'),
      ),
    );

    expect(received?.[0].actions).toEqual(['mv 10,5,0', 'sit']);
  });

  it('produces an empty actions array when the actions field is empty', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly Status[] | undefined;
    eventBus.on('STATUS_UPDATED', (status) => {
      received = status;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );

    expect(received?.[0].actions).toEqual([]);
  });

  it('applies mod 8 to dirHead and dirBody', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly Status[] | undefined;
    eventBus.on('STATUS_UPDATED', (status) => {
      received = status;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 10, 12, '')),
    );

    expect(received?.[0].dirHead).toBe(2);
    expect(received?.[0].dirBody).toBe(4);
  });

  it('merges a STATUS update into an existing entry by id instead of duplicating it', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly Status[])[] = [];
    eventBus.on('STATUS_UPDATED', (status) => {
      snapshots.push(status);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 20, 15, '3.0', 1, 1, 'sit')),
    );

    expect(snapshots[1]).toEqual([
      { id: 44, x: 20, y: 15, height: 3.0, dirHead: 1, dirBody: 1, actions: ['sit'] },
    ]);
  });

  it('accumulates users with different ids across STATUS packets', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly Status[])[] = [];
    eventBus.on('STATUS_UPDATED', (status) => {
      snapshots.push(status);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 1, 20, 15, '1.0', 0, 0, '')),
    );

    expect(snapshots[1]).toHaveLength(2);
    expect(snapshots[1].map((s) => s.id)).toEqual([44, 1]);
  });

  it('emits a defensive copy: mutating a previously received status array does not affect the next emission', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly Status[])[] = [];
    eventBus.on('STATUS_UPDATED', (status) => {
      snapshots.push(status);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );
    (snapshots[0] as Status[]).push({
      id: 999,
      x: 0,
      y: 0,
      height: 0,
      dirHead: 0,
      dirBody: 0,
      actions: [],
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 1, 20, 15, '1.0', 0, 0, '')),
    );

    expect(snapshots[1]).toHaveLength(2);
    expect(snapshots[1].map((s) => s.id)).toEqual([44, 1]);
  });

  it('emits USERS_UPDATED with the parsed fields when USERS arrives (userType 1 = user)', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly RoomUser[] | undefined;
    eventBus.on('USERS_UPDATED', (users) => {
      received = users;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );

    expect(received).toEqual([
      {
        id: 74,
        accountId: 215415,
        name: 'toto60',
        figure: 'hd-180-1022.ch-230-62',
        gender: 'm',
        motto: 'Fishing expert',
        x: 2,
        y: 15,
        height: 0,
        poolFigure: '',
        badgeCode: 'FSH',
        class: 'user',
        expression: 'std',
        action: 'crr.216',
        infostandDirection: 4,
        furni: 0,
        plate: 0,
      },
    ]);
  });

  it('handles userType 2 (pet) with no trailing infostand fields', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly RoomUser[] | undefined;
    eventBus.on('USERS_UPDATED', (users) => {
      received = users;
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(
          IncomingHeaders.USERS,
          1,
          1,
          0,
          'Fido',
          'pet_figure',
          '',
          '',
          3,
          3,
          '0.0',
          '',
          '',
          2,
        ),
      ),
    );

    expect(received?.[0]).toEqual({
      id: 1,
      accountId: 0,
      name: 'Fido',
      figure: 'pet_figure',
      gender: '',
      motto: '',
      x: 3,
      y: 3,
      height: 0,
      poolFigure: '',
      badgeCode: '',
      class: 'pet',
    });
  });

  it('handles userType 3/4 (bot) with an interactionId', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: readonly RoomUser[] | undefined;
    eventBus.on('USERS_UPDATED', (users) => {
      received = users;
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(
          IncomingHeaders.USERS,
          1,
          2,
          0,
          'Bartender',
          'bot_figure',
          '',
          '',
          4,
          4,
          '0.0',
          '',
          '',
          3,
          42,
        ),
      ),
    );

    expect(received?.[0]).toEqual({
      id: 2,
      accountId: 0,
      name: 'Bartender',
      figure: 'bot_figure',
      gender: '',
      motto: '',
      x: 4,
      y: 4,
      height: 0,
      poolFigure: '',
      badgeCode: '',
      class: 'bot',
      interactionId: 42,
    });
  });

  it('merges a USERS update into an existing entry by id instead of duplicating it', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly RoomUser[])[] = [];
    eventBus.on('USERS_UPDATED', (users) => {
      snapshots.push(users);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(
        inbound(
          IncomingHeaders.USERS,
          1,
          74,
          215415,
          'toto60',
          'hd-180-1022.ch-230-62',
          'm',
          'new motto',
          5,
          5,
          '0.0',
          '',
          'FSH',
          1,
          'std',
          'crr.216',
          4,
          0,
          0,
        ),
      ),
    );

    expect(snapshots[1]).toHaveLength(1);
    expect(snapshots[1][0].motto).toBe('new motto');
    expect(snapshots[1][0].x).toBe(5);
  });

  it('accumulates users with different ids across USERS packets', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly RoomUser[])[] = [];
    eventBus.on('USERS_UPDATED', (users) => {
      snapshots.push(users);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );

    expect(snapshots[1]).toHaveLength(2);
    expect(snapshots[1].map((u) => u.id)).toEqual([74, 79]);
  });

  it('emits a defensive copy: mutating a previously received users array does not affect the next emission', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: (readonly RoomUser[])[] = [];
    eventBus.on('USERS_UPDATED', (users) => {
      snapshots.push(users);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );
    (snapshots[0] as RoomUser[]).push({
      id: 999,
      accountId: 0,
      name: 'intrus',
      figure: '',
      gender: '',
      motto: '',
      x: 0,
      y: 0,
      height: 0,
      poolFigure: '',
      badgeCode: '',
      class: 'unknown',
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );

    expect(snapshots[1]).toHaveLength(2);
    expect(snapshots[1].map((u) => u.id)).toEqual([74, 79]);
  });

  it('a ROOM_READY clears both status and users, so a stale entry from the previous room does not survive', () => {
    const { socket, eventBus, serverWriter } = setup();

    const statusSnapshots: (readonly Status[])[] = [];
    const userSnapshots: (readonly RoomUser[])[] = [];
    eventBus.on('STATUS_UPDATED', (status) => {
      statusSnapshots.push(status);
    });
    eventBus.on('USERS_UPDATED', (users) => {
      userSnapshots.push(users);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );

    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_b 27')));

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 1, 3, 3, '0.0', 0, 0, '')),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );

    expect(statusSnapshots.at(-1)?.map((s) => s.id)).toEqual([1]);
    expect(userSnapshots.at(-1)?.map((u) => u.id)).toEqual([79]);
  });

  it('requestOwnInfo() sends GET_INFO with an empty body', () => {
    const { socket, usersManager, ciphers } = setup();

    usersManager.requestOwnInfo();

    expect(socket.sent).toHaveLength(1);
    const decrypted = decryptOutboundChunk(socket.sent[0], ciphers.c2sHeader, ciphers.c2sData);
    const packet = PacketParser.parse(decrypted);
    expect(packet.header).toBe(OutgoingHeaders.GET_INFO);
    expect(packet.body).toHaveLength(0);
  });

  it('emits OWN_INFO with the parsed fields when USER_OBJECT arrives', () => {
    const { socket, eventBus, serverWriter } = setup();

    let received: Readonly<OwnUserInfo> | undefined;
    eventBus.on('OWN_INFO', (ownInfo) => {
      received = ownInfo;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );

    expect(received).toEqual({
      userId: 232829,
      name: 'Mr.Norman',
      figure: 'hr-829-1143',
      sex: 'm',
      motto: 'Oldest Habbo.fr hotel manager',
      phTickets: 0,
      phFigure: '',
      photoFilm: 0,
      directMail: 0,
      onlineStatus: 1,
      publicProfileEnabled: 1,
      friendRequestsEnabled: 1,
      offlineMessagingEnabled: 1,
      followMeEnabled: 1,
      resumeLastRoomOnLogin: 0,
      requiresTutorial: 0,
      requiresRoomTutorial: 0,
    });
  });

  it('overwrites ownInfo wholesale on a second USER_OBJECT, rather than merging', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: Readonly<OwnUserInfo>[] = [];
    eventBus.on('OWN_INFO', (ownInfo) => {
      snapshots.push(ownInfo);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(
        inbound(
          IncomingHeaders.USER_OBJECT,
          232829,
          'Mr.Norman',
          'hr-829-1143',
          'm',
          'new motto',
          0,
          '',
          0,
          0,
          1,
          1,
          1,
          1,
          1,
          0,
          0,
          0,
        ),
      ),
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].motto).toBe('new motto');
  });

  it('emits a defensive copy: mutating a previously received OWN_INFO does not affect internal state', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: OwnUserInfo[] = [];
    eventBus.on('OWN_INFO', (ownInfo) => {
      snapshots.push(ownInfo as OwnUserInfo);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );
    snapshots[0].motto = 'tampered';

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );

    expect(snapshots[1].motto).toBe('Oldest Habbo.fr hotel manager');
  });

  it('does not clear ownInfo on ROOM_READY — it is account-level, not room-scoped', () => {
    const { socket, eventBus, serverWriter } = setup();

    const snapshots: Readonly<OwnUserInfo>[] = [];
    eventBus.on('OWN_INFO', (ownInfo) => {
      snapshots.push(ownInfo);
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.ROOM_READY, 'model_b 27')));

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].name).toBe('Mr.Norman');
  });

  it('me() returns undefined before ownInfo is known', () => {
    const { usersManager } = setup();

    expect(usersManager.me()).toBeUndefined();
  });

  it('me() returns undefined when ownInfo is known but no matching RoomUser exists yet', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );

    expect(usersManager.me()).toBeUndefined();
  });

  it('me() falls back to the plain identity (initial coordinates, no actions) when no STATUS entry exists yet', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );

    expect(usersManager.me()).toEqual({
      id: 79,
      accountId: 232829,
      name: 'Mr.Norman',
      x: 2,
      y: 15,
      height: 0,
      actions: [],
    });
  });

  it('me() merges the latest STATUS position once available, keeping the rest of the identity', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_OBJECT, ...ownInfoFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 79, 5, 6, '3.0', 0, 0, 'mv 5,6,3')),
    );

    const me = usersManager.me();
    expect(me?.x).toBe(5);
    expect(me?.y).toBe(6);
    expect(me?.height).toBe(3);
    expect(me?.name).toBe('Mr.Norman');
    expect(me?.actions).toEqual(['mv 5,6,3']);
  });

  it('getFishingAction() parses the fsh action of the given room occupant', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.STATUS, 1, 79, 5, 6, '3.0', 0, 0, 'fsh 23,17,0,1'),
      ),
    );

    expect(usersManager.getFishingAction(79)).toEqual({ x: 23, y: 17, height: 0, state: 1 });
  });

  it('getFishingAction() returns undefined for a user with no tracked STATUS', () => {
    const { usersManager } = setup();

    expect(usersManager.getFishingAction(79)).toBeUndefined();
  });

  it('getFishingAction() returns undefined when the occupant is not fishing', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 79, 5, 6, '3.0', 0, 0, 'mv 5,6,3')),
    );

    expect(usersManager.getFishingAction(79)).toBeUndefined();
  });

  it('getMoveAction() parses the mv action of the given room occupant', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 79, 5, 6, '3.0', 0, 0, 'mv 5,6,3')),
    );

    expect(usersManager.getMoveAction(79)).toEqual({ x: 5, y: 6, height: 3 });
  });

  it('getMoveAction() returns undefined for a user with no tracked STATUS', () => {
    const { usersManager } = setup();

    expect(usersManager.getMoveAction(79)).toBeUndefined();
  });

  it('getMoveAction() returns undefined when the occupant is not moving', () => {
    const { socket, usersManager, serverWriter } = setup();

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.STATUS, 1, 79, 5, 6, '3.0', 0, 0, 'fsh 23,17,0,1'),
      ),
    );

    expect(usersManager.getMoveAction(79)).toBeUndefined();
  });

  it('removes the matching entry from users and status, emitting USER_DISCONNECTED and STATUS_REMOVED with the updated lists', () => {
    const { socket, eventBus, serverWriter } = setup();

    let disconnected: [Readonly<RoomUser>, ReadonlyArray<RoomUser>] | undefined;
    let statusRemoved: [Readonly<Status>, ReadonlyArray<Status>] | undefined;
    eventBus.on('USER_DISCONNECTED', (user, users) => {
      disconnected = [user, users];
    });
    eventBus.on('STATUS_REMOVED', (status, statusList) => {
      statusRemoved = [status, statusList];
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 79, 2, 15, '0.0', 0, 0, '')),
    );

    socket.simulateReceive(serverWriter.encode(inboundUserLoggedOut(79)));

    expect(disconnected?.[0].name).toBe('Mr.Norman');
    expect(disconnected?.[1].map((u) => u.id)).toEqual([74]);

    expect(statusRemoved?.[0].id).toBe(79);
    expect(statusRemoved?.[1]).toEqual([]);
  });

  it('does not emit USER_DISCONNECTED or STATUS_REMOVED for an id that was never tracked', () => {
    const { socket, eventBus, serverWriter } = setup();

    let disconnectedFired = false;
    let statusRemovedFired = false;
    eventBus.on('USER_DISCONNECTED', () => {
      disconnectedFired = true;
    });
    eventBus.on('STATUS_REMOVED', () => {
      statusRemovedFired = true;
    });

    socket.simulateReceive(serverWriter.encode(inboundUserLoggedOut(9999)));

    expect(disconnectedFired).toBe(false);
    expect(statusRemovedFired).toBe(false);
  });

  it('only emits USER_DISCONNECTED when the id has no STATUS entry yet (left before a status update ever arrived)', () => {
    const { socket, eventBus, serverWriter } = setup();

    let disconnectedFired = false;
    let statusRemovedFired = false;
    eventBus.on('USER_DISCONNECTED', () => {
      disconnectedFired = true;
    });
    eventBus.on('STATUS_REMOVED', () => {
      statusRemovedFired = true;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );
    socket.simulateReceive(serverWriter.encode(inboundUserLoggedOut(79)));

    expect(disconnectedFired).toBe(true);
    expect(statusRemovedFired).toBe(false);
  });

  it('emits defensive copies: mutating the lists from USER_DISCONNECTED/STATUS_REMOVED does not affect internal state', () => {
    const { socket, eventBus, serverWriter } = setup();

    let remainingUsers: RoomUser[] | undefined;
    let remainingStatus: Status[] | undefined;
    eventBus.on('USER_DISCONNECTED', (_user, users) => {
      remainingUsers = users as RoomUser[];
    });
    eventBus.on('STATUS_REMOVED', (_status, status) => {
      remainingStatus = status as Status[];
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...normanUsersFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 79, 2, 15, '0.0', 0, 0, '')),
    );
    socket.simulateReceive(serverWriter.encode(inboundUserLoggedOut(79)));

    remainingUsers?.push({
      id: 999,
      accountId: 0,
      name: 'intrus',
      figure: '',
      gender: '',
      motto: '',
      x: 0,
      y: 0,
      height: 0,
      poolFigure: '',
      badgeCode: '',
      class: 'unknown',
    });
    remainingStatus?.push({ id: 999, x: 0, y: 0, height: 0, dirHead: 0, dirBody: 0, actions: [] });

    let latestUsers: readonly RoomUser[] | undefined;
    let latestStatus: readonly Status[] | undefined;
    eventBus.on('USERS_UPDATED', (users) => {
      latestUsers = users;
    });
    eventBus.on('STATUS_UPDATED', (status) => {
      latestStatus = status;
    });
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USERS, 1, ...userTypeOneFields())),
    );
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.STATUS, 1, 44, 10, 5, '2.5', 0, 0, '')),
    );

    expect(latestUsers).toHaveLength(1);
    expect(latestStatus).toHaveLength(1);
  });
});
