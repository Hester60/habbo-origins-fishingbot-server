import { describe, expect, it } from 'vitest';
import HabboConnection from '../../../src/core/connection/habbo-connection.js';
import HabboHandshake from '../../../src/app/handlers/habbo-handshake.js';
import EventBus from '../../../src/app/handlers/event-bus.js';
import PacketParser from '../../../src/core/wire/packet-parser.js';
import EncryptedFrameWriter from '../../../src/core/net/encrypted-frame-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../../src/core/protocol/headers.js';
import {
  FakeSocket,
  FakeHabboServer,
  buildInboundMessage,
  readOutboundString,
  decryptOutboundChunk,
  makeDeps,
} from '../../test-helper.js';
import { Events } from '../../../src/types.js';

function inbound(header: number, ...args: (number | string)[]): Buffer {
  return Buffer.concat([buildInboundMessage(header, ...args), Buffer.from([0x01])]);
}

function setupPostHandshake() {
  const socket = new FakeSocket();
  const connection = new HabboConnection(makeDeps(socket));
  const appEvents = new EventBus<Events>();
  const handshake = new HabboHandshake(connection, appEvents);

  const server = new FakeHabboServer();
  const ciphers = server.deriveCiphers(handshake.dh.publicKey);
  socket.simulateReceive(inbound(IncomingHeaders.SECRET_KEY, server.dh.publicKey.toString()));

  const serverWriter = new EncryptedFrameWriter(ciphers.s2cHeader, ciphers.s2cData);

  return { socket, connection, appEvents, handshake, ciphers, serverWriter };
}

describe('HabboHandshake', () => {
  it('responds to HELLO with CLIENT_INIT', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    new HabboHandshake(connection, new EventBus<Events>());

    socket.simulateReceive(inbound(IncomingHeaders.HELLO));

    expect(socket.sent).toHaveLength(1);
    const packet = PacketParser.parse(socket.sent[0].subarray(3));
    expect(packet.header).toBe(OutgoingHeaders.CLIENT_INIT);
  });

  it('responds to BANNER with GENERATE_KEY containing its own public key', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    const handshake = new HabboHandshake(connection, new EventBus<Events>());

    socket.simulateReceive(inbound(IncomingHeaders.BANNER));

    const packet = PacketParser.parse(socket.sent[0].subarray(3));
    expect(packet.header).toBe(OutgoingHeaders.GENERATE_KEY);
    const [publicKeyStr] = readOutboundString(packet.body, 0);
    expect(publicKeyStr).toBe(handshake.dh.publicKey.toString());
  });

  it('on SECRET_KEY: derives keys, switches to encrypted, and sends the login burst in order', () => {
    const { connection, socket, ciphers } = setupPostHandshake();

    expect(connection.isEncrypted()).toBe(true);
    expect(socket.sent).toHaveLength(4);

    const decrypted = socket.sent.map((frame) =>
      decryptOutboundChunk(frame, ciphers.c2sHeader, ciphers.c2sData),
    );

    const gameData = PacketParser.parse(decrypted[0]);
    expect(gameData.header).toBe(OutgoingHeaders.GAMEDATA);
    expect(gameData.body.toString('latin1')).toBe('HRL');

    const release = PacketParser.parse(decrypted[1]);
    expect(release.header).toBe(OutgoingHeaders.RELEASE_TOKEN);
    expect(readOutboundString(release.body, 0)[0]).toBe('PRODUCTION-000');

    const interstitial = PacketParser.parse(decrypted[2]);
    expect(interstitial.header).toBe(OutgoingHeaders.INTERSTITIAL_SHOWN);

    const login = PacketParser.parse(decrypted[3]);
    expect(login.header).toBe(OutgoingHeaders.LOGIN);
    let pos = 0;
    const [email, c1] = readOutboundString(login.body, pos);
    pos += c1;
    const [password, c2] = readOutboundString(login.body, pos);
    pos += c2;
    const [otp] = readOutboundString(login.body, pos);
    expect(email).toBe('bot@example.com');
    expect(password).toBe('hunter2');
    expect(otp).toBe('');
  });

  it('emits LOGIN_OK and marks the connection logged in when OK is received', () => {
    const { socket, connection, appEvents, serverWriter } = setupPostHandshake();

    let loginOkFired = false;
    appEvents.on('LOGIN_OK', () => {
      loginOkFired = true;
    });

    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.OK), Buffer.from([0x11])));

    expect(loginOkFired).toBe(true);
    expect(connection.isLoggedIn()).toBe(true);
  });

  it('emits OTP_REQUIRED on NO_LOGIN_PERMISSION, without sending anything automatically', () => {
    const { socket, appEvents, serverWriter } = setupPostHandshake();

    let otpRequiredFired = false;
    appEvents.on('OTP_REQUIRED', () => {
      otpRequiredFired = true;
    });

    const sentBefore = socket.sent.length;
    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.NO_LOGIN_PERMISSION), Buffer.from([0x11])),
    );

    expect(otpRequiredFired).toBe(true);
    expect(socket.sent).toHaveLength(sentBefore);
  });

  it('emits LOGIN_FAILED with the reason on LOGIN_ERROR', () => {
    const { socket, appEvents, serverWriter } = setupPostHandshake();

    let failedReason: string | null = null;
    appEvents.on('LOGIN_FAILED', (reason) => {
      failedReason = reason;
    });

    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.LOGIN_ERROR, 'mot de passe incorrect'),
        Buffer.from([0x11]),
      ),
    );

    expect(failedReason).toBe('mot de passe incorrect');
  });

  it('submitOtp resends LOGIN with the code, after NO_LOGIN_PERMISSION', () => {
    const { socket, handshake, ciphers, serverWriter } = setupPostHandshake();

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.NO_LOGIN_PERMISSION), Buffer.from([0x11])),
    );

    handshake.submitOtp('123456');

    expect(socket.sent).toHaveLength(5);
    const decrypted = socket.sent.map((frame) =>
      decryptOutboundChunk(frame, ciphers.c2sHeader, ciphers.c2sData),
    );
    const retry = PacketParser.parse(decrypted[4]);

    expect(retry.header).toBe(OutgoingHeaders.LOGIN);
    let pos = 0;
    pos += readOutboundString(retry.body, pos)[1];
    pos += readOutboundString(retry.body, pos)[1];
    const [otp] = readOutboundString(retry.body, pos);
    expect(otp).toBe('123456');
  });

  it('never fires OK/NO_LOGIN_PERMISSION/LOGIN_ERROR again once already logged in', () => {
    const { socket, appEvents, serverWriter } = setupPostHandshake();

    let loginOkCount = 0;
    appEvents.on('LOGIN_OK', () => {
      loginOkCount++;
    });

    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.OK), Buffer.from([0x11])));
    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.OK), Buffer.from([0x22])));

    expect(loginOkCount).toBe(1);
  });

  it('emits ACCOUNT_BANNED with the reason on USER_BANNED', () => {
    const { socket, appEvents, serverWriter } = setupPostHandshake();

    let banReason: string | null = null;
    appEvents.on('ACCOUNT_BANNED', (reason) => {
      banReason = reason;
    });

    socket.simulateReceive(
      serverWriter.encode(inbound(IncomingHeaders.USER_BANNED, 'cheating'), Buffer.from([0x11])),
    );

    expect(banReason).toBe('cheating');
  });

  it('still emits ACCOUNT_BANNED even after already logged in — unlike OK/OTP_REQUIRED/LOGIN_FAILED, a ban is not login-only', () => {
    const { socket, connection, appEvents, serverWriter } = setupPostHandshake();

    socket.simulateReceive(serverWriter.encode(inbound(IncomingHeaders.OK), Buffer.from([0x11])));
    expect(connection.isLoggedIn()).toBe(true);

    let banReason: string | null = null;
    appEvents.on('ACCOUNT_BANNED', (reason) => {
      banReason = reason;
    });
    socket.simulateReceive(
      serverWriter.encode(
        inbound(IncomingHeaders.USER_BANNED, 'banned mid-session'),
        Buffer.from([0x22]),
      ),
    );

    expect(banReason).toBe('banned mid-session');
  });
});
