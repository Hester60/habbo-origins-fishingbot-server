import { Events, FishingAction, HostConfig, Hotels, Me, MoveAction } from '../../types.js';
import Socket from '../../core/interfaces/socket.js';
import EventBus from '../handlers/event-bus.js';
import generateReleaseToken from '../../core/protocol/generate-release-token.js';
import dial from '../../core/net/dial.js';
import HabboConnection from '../../core/connection/habbo-connection.js';
import GamedataPayloadBuilder from '../../core/protocol/gamedata-payload-builder.js';
import ClientVersionProvider from '../../core/protocol/client-version-provider.js';
import { HOSTS_CONFIG } from '../../core/protocol/hosts-config.js';
import HabboHandShake from '../handlers/habbo-handshake.js';
import HabboKeepAlive from '../handlers/habbo-keep-alive.js';
import HabboPublicRoomManager from '../handlers/habbo-public-room-manager.js';
import PacketLogger from '../handlers/packet-logger.js';
import HabboUsersManager from '../handlers/habbo-users-manager.js';
import HabboPlayerManager from '../handlers/habbo-player-manager.js';

type BotOptions = {
  /** @default true */
  logPackets?: boolean;
};

/**
 * Public facade for a single Habbo bot session — the one entry point meant
 * to be consumed by any UI (CLI, web server, browser extension...). Owns no
 * protocol logic itself: it resolves the per-hotel connection details, wires
 * the core transport (HabboConnection) together with the handshake and
 * keep-alive handlers, and republishes their outcomes on a single public
 * EventBus. Consumers decide entirely for themselves how to react to those
 * events (log, update a UI, notify...) — this class never does.
 * connect() is not safe to call again while already connected: it always
 * builds a fresh HabboConnection/HabboHandShake/HabboKeepAlive, even reusing
 * an existing socket, which would double-wire packet listeners on the same
 * stream.
 */
export default class Bot {
  readonly eventBus: EventBus<Events>;

  private readonly hostConfig: HostConfig;
  private readonly email: string;
  private readonly password: string;

  private socket: Socket | undefined;

  private connection: HabboConnection | undefined;
  private handshake: HabboHandShake | undefined;
  private roomManager: HabboPublicRoomManager | undefined;
  private usersManager: HabboUsersManager | undefined;
  private playerManager: HabboPlayerManager | undefined;

  private readonly logPackets: boolean;

  constructor(email: string, password: string, hotel: Hotels = 'hhous', options: BotOptions = {}) {
    this.hostConfig = HOSTS_CONFIG[hotel];
    this.eventBus = new EventBus();

    this.email = email;
    this.password = password;

    this.logPackets = options.logPackets ?? true;
  }

  public async connect() {
    if (this.socket) {
      return;
    }

    const version: number = await ClientVersionProvider.fetchClientVersion();
    const gamedataPayload: string = GamedataPayloadBuilder.build(
      this.hostConfig.gamedataUrl,
      version,
    ).toString('latin1');
    const releaseToken: string = generateReleaseToken();

    this.socket = await dial(this.hostConfig.host, this.hostConfig.port);

    this.connection = new HabboConnection({
      socket: this.socket,
      email: this.email,
      password: this.password,
      gamedataPayload: gamedataPayload,
      releaseToken,
    });

    if (this.logPackets) {
      this.enablePacketLogging();
    }

    new HabboKeepAlive(this.connection);
    this.playerManager = new HabboPlayerManager(this.connection, this.eventBus);
    this.roomManager = new HabboPublicRoomManager(this.connection, this.eventBus);
    this.usersManager = new HabboUsersManager(this.connection, this.eventBus);
    this.handshake = new HabboHandShake(this.connection, this.eventBus);
  }

  // SDK

  public submitOtp(code: string): void {
    this.handshake?.submitOtp(code);
  }

  public moveToRoom(flatId: number): void {
    this.roomManager?.moveToRoom(flatId);
  }

  public requestHeightmap(): void {
    this.roomManager?.requestHeightmap();
  }

  public requestUsers(): void {
    if (this.isRoomEntered()) {
      this.usersManager?.requestUsers();
    }
  }

  public requestOwnInfo(): void {
    this.usersManager?.requestOwnInfo();
  }

  public isRoomEntered(): boolean {
    if (this.roomManager) {
      return this.roomManager.isRoomEntered();
    }

    return false;
  }

  public me(): Me | undefined {
    return this.usersManager?.me();
  }

  public move(x: number, y: number): void {
    if (this.isRoomEntered()) {
      this.playerManager?.move(x, y);
    }
  }

  public startFishing(fishingId: number): void {
    if (this.isRoomEntered()) {
      this.playerManager?.startFishing(fishingId);
    }
  }

  public requestFishingStats(): void {
    if (this.isRoomEntered()) {
      this.playerManager?.requestFishingStats();
    }
  }

  public getFishingAction(userId: number): FishingAction | undefined {
    return this.usersManager?.getFishingAction(userId);
  }

  public getMoveAction(userId: number): MoveAction | undefined {
    return this.usersManager?.getMoveAction(userId);
  }

  private enablePacketLogging(): void {
    if (this.connection) {
      new PacketLogger(this.connection);
    }
  }
}
