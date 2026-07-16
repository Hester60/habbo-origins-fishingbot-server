import ChachaCipher from './core/crypto/chacha-cipher.js';

export type DerivedKeys = {
  c2sData: ChachaCipher;
  c2sHeader: ChachaCipher;
  s2cData: ChachaCipher;
  s2cHeader: ChachaCipher;
};

export type ParsedPacket = {
  header: number;
  body: Buffer;
};

export type Events = {
  LOGIN_OK: [];
  OTP_REQUIRED: [];
  LOGIN_FAILED: [reason: string];
  ACCOUNT_BANNED: [reason: string]; // Not tested yet
  ROOM_ENTERED: [flatId: number];
  HEIGHTMAP_RECEIVED: [data: string[]];
  ACTIVE_OBJECT_ADDED: [
    newObject: Readonly<ActiveRoomObject>,
    activeObjects: ReadonlyArray<ActiveRoomObject>,
  ];
  ACTIVE_OBJECT_REMOVED: [
    objectRemoved: Readonly<ActiveRoomObject>,
    activeObjects: ReadonlyArray<ActiveRoomObject>,
  ];
  STATUS_UPDATED: [status: ReadonlyArray<Status>];
  USERS_UPDATED: [users: ReadonlyArray<RoomUser>];
  OWN_INFO: [ownInfo: Readonly<OwnUserInfo>];
  USER_DISCONNECTED: [userDisconnected: Readonly<RoomUser>, users: ReadonlyArray<RoomUser>];
  STATUS_REMOVED: [statusRemoved: Readonly<Status>, status: ReadonlyArray<Status>];
  FISH_CAUGHT_MSG: [userId: number, chatMsg: string, iconID: number];
};

export type Hotels = 'hhous' | 'hhoes' | 'hhobr';

export type HostConfig = {
  gamedataUrl: string;
  host: string;
  port: number;
};

export type ActiveRoomObject = {
  id: string;
  owner: number;
  className: string;
  x: number;
  y: number;
};

export type Status = {
  id: number;
  x: number;
  y: number;
  height: number;
  dirHead: number;
  dirBody: number;
  actions: string[];
};

export type RoomUser = {
  id: number; // same id space as Status.id
  accountId: number; // persistent account id (Lingo: #accountId)
  name: string;
  figure: string;
  gender: string;
  motto: string;
  x: number;
  y: number;
  height: number;
  poolFigure: string;
  badgeCode: string;
  class: 'user' | 'pet' | 'bot' | 'unknown';
  // Only present when class === 'user' (userType === 1) — the wire calls
  // this an "infostand": the little status panel shown above the avatar.
  expression?: string;
  action?: string;
  infostandDirection?: number;
  furni?: number;
  plate?: number;
  // Only present when class === 'bot' (userType === 3 or 4).
  interactionId?: number;
};

export type Me = {
  id: number;
  accountId: number;
  name: string;
  x: number;
  y: number;
  height: number;
  actions: string[];
};

// handleUserObj (header 5, USER_OBJECT): our own account info
export type OwnUserInfo = {
  userId: number;
  name: string;
  figure: string;
  sex: string;
  motto: string;
  phTickets: number;
  phFigure: string;
  photoFilm: number;
  directMail: number;
  onlineStatus: number;
  publicProfileEnabled: number;
  friendRequestsEnabled: number;
  offlineMessagingEnabled: number;
  followMeEnabled: number;
  resumeLastRoomOnLogin: number;
  requiresTutorial: number;
  requiresRoomTutorial: number;
};

export type Point = {
  x: number;
  y: number;
};

export type FishingTarget = {
  fish: ActiveRoomObject;
  alreadyInRange: boolean;
  targetTile?: Point;
};

// Actions
export type FishingAction = { x: number; y: number; height: number; state: number };
export type MoveAction = { x: number; y: number; height: number };
