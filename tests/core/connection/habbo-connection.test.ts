import { describe, expect, it } from 'vitest';
import HabboConnection from '../../../src/core/connection/habbo-connection.js';
import ChachaCipher from '../../../src/core/crypto/chacha-cipher.js';
import Base64Codec from '../../../src/core/wire/base64-codec.js';
import { FakeSocket, makeCiphers, makeDeps } from '../../test-helper.js';

describe('HabboConnection', () => {
  it('starts neither encrypted nor logged in', () => {
    const connection = new HabboConnection(makeDeps(new FakeSocket()));

    expect(connection.isEncrypted()).toBe(false);
    expect(connection.isLoggedIn()).toBe(false);
  });

  it('sends a packet in plaintext framing before switching to encrypted', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    const packet = Base64Codec.encodeInt(206, 2);
    connection.send(packet);

    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toEqual(
      Buffer.concat([Base64Codec.encodeInt(packet.length, 3), packet]),
    );
  });

  it('switchToEncrypted() flips isEncrypted() and send() now encrypts', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    const ciphers = makeCiphers();

    connection.switchToEncrypted(ciphers);
    expect(connection.isEncrypted()).toBe(true);

    const packet = Base64Codec.encodeInt(206, 2);
    connection.send(packet);

    const verifyHeaderCipher = new ChachaCipher(Buffer.alloc(32, 0xcc), Buffer.alloc(12, 0xdd));
    const verifyDataCipher = new ChachaCipher(Buffer.alloc(32, 0xaa), Buffer.alloc(12, 0xbb));

    const frame = socket.sent[0];
    const decryptedHeader = verifyHeaderCipher.apply(Base64Codec.decodeBytes(frame.subarray(0, 6)));
    const length = Base64Codec.decodeInt(decryptedHeader.subarray(1, 4));
    const decryptedPacket = verifyDataCipher.apply(
      Base64Codec.decodeBytes(frame.subarray(6, 6 + length)),
    );

    expect(decryptedPacket).toEqual(packet);
  });

  it('switchToLoggedIn() flips isLoggedIn()', () => {
    const connection = new HabboConnection(makeDeps(new FakeSocket()));

    connection.switchToLoggedIn();

    expect(connection.isLoggedIn()).toBe(true);
  });

  it('notifies subscribers with the parsed packet when plaintext data arrives', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    let received: { header: number; body: Buffer } | null = null;
    connection.subscribeIncoming((packet) => {
      received = packet;
    });

    const innerPacket = Base64Codec.encodeInt(0, 2);
    const frame = Buffer.concat([innerPacket, Buffer.from([0x01])]);
    socket.simulateReceive(frame);

    expect(received).not.toBeNull();
    expect(received!.header).toBe(0);
  });

  it('notifies subscribers with the parsed packet when encrypted data arrives', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    const ciphers = makeCiphers();
    connection.switchToEncrypted(ciphers);

    let received: { header: number; body: Buffer } | null = null;
    connection.subscribeIncoming((packet) => {
      received = packet;
    });

    const serverHeaderCipher = new ChachaCipher(Buffer.alloc(32, 0x33), Buffer.alloc(12, 0x44));
    const serverDataCipher = new ChachaCipher(Buffer.alloc(32, 0x11), Buffer.alloc(12, 0x22));

    const innerPacket = Base64Codec.encodeInt(3, 2);
    const plaintext = Buffer.concat([innerPacket, Buffer.from([0x01])]);

    const encryptedData = Base64Codec.encodeBytes(serverDataCipher.apply(plaintext));
    const length = Base64Codec.encodeInt(encryptedData.length, 3);
    const header = Buffer.concat([Buffer.from([0x2a]), length]);
    const encryptedHeader = Base64Codec.encodeBytes(serverHeaderCipher.apply(header));
    const frame = Buffer.concat([encryptedHeader, encryptedData]);

    socket.simulateReceive(frame);

    expect(received).not.toBeNull();
    expect(received!.header).toBe(3);
  });

  it('notifies every subscriber for the same packet', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    let firstCalled = false;
    let secondCalled = false;
    connection.subscribeIncoming(() => {
      firstCalled = true;
    });
    connection.subscribeIncoming(() => {
      secondCalled = true;
    });

    const innerPacket = Base64Codec.encodeInt(0, 2);
    const frame = Buffer.concat([innerPacket, Buffer.from([0x01])]);
    socket.simulateReceive(frame);

    expect(firstCalled).toBe(true);
    expect(secondCalled).toBe(true);
  });

  it('notifies outgoing subscribers with the parsed packet when send() is called (plaintext)', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    let received: { header: number; body: Buffer } | null = null;
    connection.subscribeOutgoing((packet) => {
      received = packet;
    });

    const packet = Base64Codec.encodeInt(206, 2);
    connection.send(packet);

    expect(received).not.toBeNull();
    expect(received!.header).toBe(206);
  });

  it('notifies outgoing subscribers with the plain packet even once encrypted, not the encrypted bytes', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));
    connection.switchToEncrypted(makeCiphers());

    let received: { header: number; body: Buffer } | null = null;
    connection.subscribeOutgoing((packet) => {
      received = packet;
    });

    const packet = Base64Codec.encodeInt(4, 2);
    connection.send(packet);

    expect(received).not.toBeNull();
    expect(received!.header).toBe(4);
  });

  it('notifies every outgoing subscriber for the same packet', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    let firstCalled = false;
    let secondCalled = false;
    connection.subscribeOutgoing(() => {
      firstCalled = true;
    });
    connection.subscribeOutgoing(() => {
      secondCalled = true;
    });

    connection.send(Base64Codec.encodeInt(206, 2));

    expect(firstCalled).toBe(true);
    expect(secondCalled).toBe(true);
  });

  it('does not notify incoming subscribers on send(), or outgoing subscribers on receive()', () => {
    const socket = new FakeSocket();
    const connection = new HabboConnection(makeDeps(socket));

    let incomingCalled = false;
    let outgoingCalled = false;
    connection.subscribeIncoming(() => {
      incomingCalled = true;
    });
    connection.subscribeOutgoing(() => {
      outgoingCalled = true;
    });

    connection.send(Base64Codec.encodeInt(206, 2));

    expect(outgoingCalled).toBe(true);
    expect(incomingCalled).toBe(false);
  });

  it('assigns a unique uuid to each connection instance', () => {
    const a = new HabboConnection(makeDeps(new FakeSocket()));
    const b = new HabboConnection(makeDeps(new FakeSocket()));

    expect(a.uuid).toEqual(expect.any(String));
    expect(a.uuid.length).toBeGreaterThan(0);
    expect(a.uuid).not.toBe(b.uuid);
  });
});
