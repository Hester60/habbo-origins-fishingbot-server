import ChachaCipher from '../src/core/crypto/chacha-cipher.js';
import Base64Codec from '../src/core/wire/base64-codec.js';
import Vl64Codec from '../src/core/wire/vl64-codec.js';
import DiffieHellman from '../src/core/crypto/diffie-hellman.js';
import BobbaKeyDerivation from '../src/core/crypto/bobba-key-derivation.js';
import HabboConnection from '../src/core/connection/habbo-connection.js';
import * as net from 'node:net';

export class FakeSocket {
  readonly sent: Buffer[] = [];
  private dataCallback: ((data: Buffer) => void) | null = null;

  write(data: Buffer): void {
    this.sent.push(data);
  }

  onData(callback: (data: Buffer) => void): void {
    this.dataCallback = callback;
  }

  simulateReceive(data: Buffer): void {
    this.dataCallback?.(data);
  }
}

export function makeDeps(socket: FakeSocket) {
  return {
    socket,
    email: 'bot@example.com',
    password: 'hunter2',
    gamedataPayload: 'HRL',
    releaseToken: 'PRODUCTION-000',
  };
}

export function readyConnection(socket: FakeSocket): HabboConnection {
  const connection = new HabboConnection(makeDeps(socket));
  connection.switchToEncrypted(makeCiphers());
  connection.switchToLoggedIn();
  return connection;
}

export function makeCiphers() {
  return {
    c2sHeader: new ChachaCipher(Buffer.alloc(32, 0xcc), Buffer.alloc(12, 0xdd)),
    c2sData: new ChachaCipher(Buffer.alloc(32, 0xaa), Buffer.alloc(12, 0xbb)),
    s2cHeader: new ChachaCipher(Buffer.alloc(32, 0x33), Buffer.alloc(12, 0x44)),
    s2cData: new ChachaCipher(Buffer.alloc(32, 0x11), Buffer.alloc(12, 0x22)),
  };
}

export function buildInboundMessage(header: number, ...args: (number | string)[]): Buffer {
  const chunks: Buffer[] = [Base64Codec.encodeInt(header, 2)];
  for (const arg of args) {
    if (typeof arg === 'number') chunks.push(Vl64Codec.encode(arg));
    else chunks.push(Buffer.concat([Buffer.from(arg, 'latin1'), Buffer.from([0x02])]));
  }
  return Buffer.concat(chunks);
}

export function inbound(header: number, ...args: (number | string)[]): Buffer {
  return Buffer.concat([buildInboundMessage(header, ...args), Buffer.from([0x01])]);
}

export function readOutboundString(bytes: Buffer, pos: number): [string, number] {
  const length = Base64Codec.decodeInt(bytes.subarray(pos, pos + 2));
  return [bytes.toString('latin1', pos + 2, pos + 2 + length), 2 + length];
}

export class FakeHabboServer {
  readonly dh = new DiffieHellman(15n);

  deriveCiphers(clientPublicKey: bigint) {
    return BobbaKeyDerivation.derive(this.dh.computeSharedSecretBytes(clientPublicKey));
  }
}

export function decryptOutboundChunk(
  frame: Buffer,
  headerCipher: ChachaCipher,
  dataCipher: ChachaCipher,
): Buffer {
  const headerB64 = frame.subarray(0, 6);
  const payloadB64 = frame.subarray(6);
  const decHeader = headerCipher.apply(Base64Codec.decodeBytes(headerB64));
  const len = Base64Codec.decodeInt(decHeader.subarray(1, 4));
  return dataCipher.apply(Base64Codec.decodeBytes(payloadB64.subarray(0, len)));
}

export function startTestServer(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}
