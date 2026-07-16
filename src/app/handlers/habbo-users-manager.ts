import HabboConnection from '../../core/connection/habbo-connection.js';
import EventBus from './event-bus.js';
import {
  Events,
  FishingAction,
  Me,
  MoveAction,
  OwnUserInfo,
  ParsedPacket,
  RoomUser,
  Status,
} from '../../types.js';
import PacketWriter from '../../core/wire/packet-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';
import PacketReader from '../../core/wire/packet-reader.js';
import AvatarActions from '../helpers/avatar-actions.js';

/**
 * Tracks everyone currently in the room — position (STATUS), identity and
 * initial position (USERS), and departures (USER_LOGGED_OUT) — plus the
 * bot's own account info (USER_OBJECT). me() resolves which roster entry
 * corresponds to the bot itself. status/users reset on every ROOM_READY;
 * ownInfo doesn't, since it's account-level, not room-scoped.
 */
export default class HabboUsersManager {
  private status: Status[] = [];
  private users: RoomUser[] = [];
  private ownInfo: OwnUserInfo | undefined;

  private readonly packetHandlers: Map<number, (body: Buffer) => void> = new Map([
    [IncomingHeaders.STATUS, (body: Buffer) => this.onStatus(body)],
    [IncomingHeaders.ROOM_READY, () => this.onRoomReady()],
    [IncomingHeaders.USERS, (body: Buffer) => this.onUsers(body)],
    [IncomingHeaders.USER_OBJECT, (body: Buffer) => this.onOwnInfo(body)],
    [IncomingHeaders.USER_LOGGED_OUT, (body: Buffer) => this.onUserLoggedOut(body)],
  ]);

  constructor(
    private readonly habboConnection: HabboConnection,
    private readonly eventBus: EventBus<Events>,
  ) {
    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      this.packetHandlers.get(parsedPacket.header)?.(parsedPacket.body);
    });
  }

  public requestUsers(): void {
    this.sendGUsrsPacket();
  }

  public requestOwnInfo(): void {
    if (this.habboConnection.isLoggedIn() && this.habboConnection.isEncrypted()) {
      this.sendGetInfo();
    }
  }

  public me(): Me | undefined {
    if (this.ownInfo?.userId) {
      const userId: number = this.ownInfo.userId;
      const user: RoomUser | undefined = this.users.find((u: RoomUser) => u.accountId === userId);

      if (undefined !== user) {
        const myself: Me = {
          id: user.id,
          name: user.name,
          accountId: user.accountId,
          x: user.x,
          y: user.y,
          height: user.height,
          actions: [],
        };

        const currentStatus: Status | undefined = this.status.find((s: Status) => s.id === user.id);

        if (undefined !== currentStatus) {
          const x: number = currentStatus.x;
          const y: number = currentStatus.y;
          const height: number = currentStatus.height;
          const actions: string[] = currentStatus.actions;

          return {
            ...myself,
            x,
            y,
            height,
            actions,
          };
        } else {
          return myself;
        }
      }
    }

    return undefined;
  }

  public getFishingAction(userId: number): FishingAction | undefined {
    const userStatus: Status | undefined = this.status.find((s: Status) => s.id === userId);
    return userStatus ? AvatarActions.getFishingAction(userStatus.actions) : undefined;
  }

  public getMoveAction(userId: number): MoveAction | undefined {
    const userStatus: Status | undefined = this.status.find((s: Status) => s.id === userId);
    return userStatus ? AvatarActions.getMoveAction(userStatus.actions) : undefined;
  }

  // Packets

  private sendGUsrsPacket(): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.G_USRS).build());
  }

  private sendGetInfo(): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.GET_INFO).build());
  }

  // Listeners

  private onStatus(body: Buffer): void {
    const reader = new PacketReader(body);
    const count = reader.int();
    const updatedStatus: Status[] = [];

    for (let i = 0; i < count; i++) {
      const id: number = reader.int();
      const x = reader.int();
      const y = reader.int();
      const height = parseFloat(reader.str());
      const dirHead = reader.int() % 8;
      const dirBody = reader.int() % 8;
      const actionsRaw = reader.str();
      const actions = actionsRaw.split('/').filter((a) => a.length > 0);

      updatedStatus.push({
        id,
        x,
        y,
        height,
        dirHead,
        dirBody,
        actions,
      });
    }

    for (const update of updatedStatus) {
      const index = this.status.findIndex((s) => s.id === update.id);
      if (index > -1) {
        this.status[index] = update;
      } else {
        this.status.push(update);
      }
    }

    this.eventBus.emit('STATUS_UPDATED', [...this.status]);
  }

  private onRoomReady(): void {
    this.status = [];
    this.users = [];
  }

  private onUserLoggedOut(body: Buffer): void {
    const userId: number = parseInt(body.toString('latin1'), 10);

    const userIndex: number = this.users.findIndex((u: RoomUser) => u.id === userId);
    const statusIndex: number = this.status.findIndex((s: Status) => s.id === userId);

    if (userIndex > -1) {
      const disconnectedUser: RoomUser = this.users[userIndex];
      this.users.splice(userIndex, 1);
      this.eventBus.emit('USER_DISCONNECTED', { ...disconnectedUser }, [...this.users]);
    }

    if (statusIndex > -1) {
      const removedStatus: Status = this.status[statusIndex];
      this.status.splice(statusIndex, 1);
      this.eventBus.emit('STATUS_REMOVED', { ...removedStatus }, [...this.status]);
    }
  }

  private onUsers(body: Buffer): void {
    const reader = new PacketReader(body);
    const count = reader.int();
    const updatedUsers: RoomUser[] = [];

    for (let i = 0; i < count; i++) {
      const id = reader.int();
      const accountId = reader.int();
      const name = reader.str();
      const figure = reader.str();
      const gender = reader.str();
      const motto = reader.str();
      const x = reader.int();
      const y = reader.int();
      const height = parseFloat(reader.str());
      const poolFigure = reader.str();
      const badgeCode = reader.str();
      const userType = reader.int();

      const roomUser: RoomUser = {
        id,
        accountId,
        name,
        figure,
        gender,
        motto,
        x,
        y,
        height,
        poolFigure,
        badgeCode,
        class:
          userType === 1
            ? 'user'
            : userType === 2
              ? 'pet'
              : userType === 3 || userType === 4
                ? 'bot'
                : 'unknown',
      };

      if (userType === 1) {
        roomUser.expression = reader.str();
        roomUser.action = reader.str();
        roomUser.infostandDirection = reader.int();
        roomUser.furni = reader.int();
        roomUser.plate = reader.int();
      } else if (userType === 3 || userType === 4) {
        roomUser.interactionId = reader.int();
      }

      updatedUsers.push(roomUser);
    }

    for (const update of updatedUsers) {
      const index = this.users.findIndex((u) => u.id === update.id);
      if (index > -1) {
        this.users[index] = update;
      } else {
        this.users.push(update);
      }
    }

    this.eventBus.emit('USERS_UPDATED', [...this.users]);
  }

  private onOwnInfo(body: Buffer): void {
    const reader = new PacketReader(body);

    this.ownInfo = {
      userId: reader.int(),
      name: reader.str(),
      figure: reader.str(),
      sex: reader.str(),
      motto: reader.str(),
      phTickets: reader.int(),
      phFigure: reader.str(),
      photoFilm: reader.int(),
      directMail: reader.int(),
      onlineStatus: reader.int(),
      publicProfileEnabled: reader.int(),
      friendRequestsEnabled: reader.int(),
      offlineMessagingEnabled: reader.int(),
      followMeEnabled: reader.int(),
      resumeLastRoomOnLogin: reader.int(),
      requiresTutorial: reader.int(),
      requiresRoomTutorial: reader.int(),
    };

    this.eventBus.emit('OWN_INFO', { ...this.ownInfo });
  }
}
