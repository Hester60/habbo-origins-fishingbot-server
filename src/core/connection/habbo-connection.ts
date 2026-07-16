import { randomUUID } from 'node:crypto';
import Socket from '../interfaces/socket.js';
import DiffieHellman from '../crypto/diffie-hellman.js';
import PlainTextFrameReader from '../net/plaintext-frame-reader.js';
import EncryptedFrameReader from '../net/encrypted-frame-reader.js';
import PacketParser from '../wire/packet-parser.js';
import PlaintextFrameWriter from '../net/plaintext-frame-writer.js';
import EncryptedFrameWriter from '../net/encrypted-frame-writer.js';
import { DerivedKeys, ParsedPacket } from '../../types.js';

type ConnectionDeps = {
  socket: Socket;
  diffieHellman?: DiffieHellman;
  email: string;
  password: string;
  gamedataPayload: string;
  releaseToken: string;
};

/**
 * Pure transport mechanics for a Habbo session — knows nothing about
 * headers, login, or any protocol-specific behavior. Its only concerns:
 * choosing plaintext vs encrypted framing (before/after switchToEncrypted),
 * and publishing every parsed packet to whoever subscribed. Higher-level
 * behavior (handshake, keepalive, future features) lives in separate
 * modules that consume this class from the outside, never the reverse.
 */
export default class HabboConnection {
  readonly uuid: string = randomUUID();

  private readonly incomingListeners: Array<(packet: ParsedPacket) => void> = [];
  private readonly outgoingListeners: Array<(packet: ParsedPacket) => void> = [];

  private encrypted: boolean = false;
  private loggedIn: boolean = false;

  private encryptedFrameReader?: EncryptedFrameReader;
  private encryptedFrameWriter?: EncryptedFrameWriter;

  constructor(
    public readonly deps: ConnectionDeps,
    private plainTextFrameReader: PlainTextFrameReader = new PlainTextFrameReader(),
  ) {
    this.handleIncomingData();
  }

  switchToEncrypted(ciphers: DerivedKeys): void {
    this.encryptedFrameWriter = new EncryptedFrameWriter(ciphers.c2sHeader, ciphers.c2sData);
    this.encryptedFrameReader = new EncryptedFrameReader(ciphers.s2cHeader, ciphers.s2cData);
    this.encrypted = true;
  }

  switchToLoggedIn(): void {
    this.loggedIn = true;
  }

  send(packet: Buffer): void {
    if (this.encrypted && this.encryptedFrameWriter) {
      this.deps.socket.write(this.encryptedFrameWriter.encode(packet));
    } else {
      this.deps.socket.write(PlaintextFrameWriter.encode(packet));
    }
    this.dispatchOutgoing(PacketParser.parse(packet));
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  isEncrypted(): boolean {
    return this.encrypted;
  }

  subscribeIncoming(callback: (packet: ParsedPacket) => void): void {
    this.incomingListeners.push(callback);
  }

  subscribeOutgoing(callback: (packet: ParsedPacket) => void): void {
    this.outgoingListeners.push(callback);
  }

  private dispatchIncoming(parsedPacket: ParsedPacket): void {
    for (const listener of this.incomingListeners) {
      listener(parsedPacket);
    }
  }

  private dispatchOutgoing(parsedPacket: ParsedPacket): void {
    for (const listener of this.outgoingListeners) {
      listener(parsedPacket);
    }
  }

  private handleIncomingData() {
    this.deps.socket.onData((data: Buffer) => {
      let packets: Buffer[];

      if (this.encrypted && this.encryptedFrameReader) {
        this.encryptedFrameReader.push(data);
        packets = this.encryptedFrameReader.read();
      } else {
        this.plainTextFrameReader.push(data);
        packets = this.plainTextFrameReader.read();
      }

      for (const packet of packets) {
        const parsedPacket: ParsedPacket = PacketParser.parse(packet);
        this.dispatchIncoming(parsedPacket);
      }
    });
  }
}
