import Base64Codec from '../../core/wire/base64-codec.js';
import PacketReader from '../../core/wire/packet-reader.js';
import BobbaKeyDerivation from '../../core/crypto/bobba-key-derivation.js';
import PacketWriter from '../../core/wire/packet-writer.js';
import DiffieHellman from '../../core/crypto/diffie-hellman.js';
import HabboConnection from '../../core/connection/habbo-connection.js';
import EventBus from './event-bus.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';
import { DerivedKeys, Events, ParsedPacket } from '../../types.js';

/**
 * Owns the handshake and login state machine: the Diffie-Hellman exchange,
 * switching the connection to encrypted, sending the post-crypto login
 * burst, and reacting to the server's login outcome (OK / OTP required /
 * error) — plus USER_BANNED, which isn't strictly a login outcome (a ban
 * can land at any point in the session, not just during login) but is
 * handled here anyway since it rides the same packet subscription. Knows
 * nothing about the socket or transport — only ever talks to
 * HabboConnection's public surface (send/switchToEncrypted/subscribe).
 * Publishes its own outcomes (LOGIN_OK, OTP_REQUIRED, LOGIN_FAILED,
 * USER_BANNED) on a shared EventBus passed in from outside, so callers
 * never need to know this class exists to react to them.
 */
export default class HabboHandShake {
  readonly dh: DiffieHellman;

  private readonly packetHandlers: Map<number, (body: Buffer) => void> = new Map([
    [IncomingHeaders.HELLO, () => this.sendClientInitPacket()],
    [IncomingHeaders.BANNER, () => this.sendGenerateKeyPacket()],
    [IncomingHeaders.SECRET_KEY, (body: Buffer) => this.executeLoginPipeline(body)],
    [IncomingHeaders.OK, () => this.emitLoggedIn()],
    [IncomingHeaders.NO_LOGIN_PERMISSION, () => this.emitOtpRequired()],
    [IncomingHeaders.LOGIN_ERROR, (body: Buffer) => this.emitLoginFailed(body)],
    [IncomingHeaders.USER_BANNED, (body: Buffer) => this.emitUserBanned(body)],
  ]);

  constructor(
    private readonly habboConnection: HabboConnection,
    private readonly eventBus: EventBus<Events>,
  ) {
    this.dh = habboConnection.deps.diffieHellman ?? new DiffieHellman();

    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      this.packetHandlers.get(parsedPacket.header)?.(parsedPacket.body);
    });
  }

  public submitOtp(code: string): void {
    if (!this.habboConnection.isLoggedIn() && this.habboConnection.isEncrypted()) {
      this.sendLoginPacket(code);
    }
  }

  // Packets

  private sendClientInitPacket(): void {
    const packet: Buffer = Base64Codec.encodeInt(OutgoingHeaders.CLIENT_INIT, 2);
    this.habboConnection.send(packet);
  }

  private sendGenerateKeyPacket(): void {
    const packet: Buffer = new PacketWriter(OutgoingHeaders.GENERATE_KEY)
      .str(this.dh.publicKey.toString())
      .build();
    this.habboConnection.send(packet);
  }

  private sendGameDataPacket(): void {
    const gameDataPacket: Buffer = new PacketWriter(OutgoingHeaders.GAMEDATA)
      .raw(this.habboConnection.deps.gamedataPayload)
      .build();
    this.habboConnection.send(gameDataPacket);
  }

  private sendReleaseTokenPacket(): void {
    const releasePacket: Buffer = new PacketWriter(OutgoingHeaders.RELEASE_TOKEN)
      .str(this.habboConnection.deps.releaseToken)
      .build();
    this.habboConnection.send(releasePacket);
  }

  private sendInterstitialShownPacket(): void {
    const interstitialShownPacket: Buffer = new PacketWriter(
      OutgoingHeaders.INTERSTITIAL_SHOWN,
    ).build();
    this.habboConnection.send(interstitialShownPacket);
  }

  private sendLoginPacket(otp: string = ''): void {
    const loginPacket: Buffer = new PacketWriter(OutgoingHeaders.LOGIN)
      .str(this.habboConnection.deps.email)
      .str(this.habboConnection.deps.password)
      .str(otp)
      .str('')
      .build();

    this.habboConnection.send(loginPacket);
  }

  // Listeners

  private emitLoggedIn(): void {
    if (!this.habboConnection.isLoggedIn()) {
      this.habboConnection.switchToLoggedIn();
      this.eventBus.emit('LOGIN_OK');
    }
  }

  private emitOtpRequired(): void {
    if (!this.habboConnection.isLoggedIn()) {
      this.eventBus.emit('OTP_REQUIRED');
    }
  }

  private emitLoginFailed(body: Buffer): void {
    if (!this.habboConnection.isLoggedIn()) {
      const reason: string = new PacketReader(body).str();
      this.eventBus.emit('LOGIN_FAILED', reason);
    }
  }

  private emitUserBanned(body: Buffer): void {
    const reason: string = new PacketReader(body).str();
    this.eventBus.emit('ACCOUNT_BANNED', reason);
  }

  private executeLoginPipeline(body: Buffer): void {
    const encodedPublicKey: string = new PacketReader(body).str();
    const publicKey: bigint = BigInt(encodedPublicKey);
    const sharedSecret: Buffer = this.dh.computeSharedSecretBytes(publicKey);
    const keys: DerivedKeys = BobbaKeyDerivation.derive(sharedSecret);

    this.habboConnection.switchToEncrypted(keys);

    this.sendGameDataPacket();
    this.sendReleaseTokenPacket();
    this.sendInterstitialShownPacket();
    this.sendLoginPacket();
  }
}
