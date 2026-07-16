# habbo-origins-fishing-toolkit

A TypeScript client for Habbo Origins (Shockwave) that automates the fishing minigame: login, room navigation, occupant tracking, movement, casting, and catch feedback — exposed as a single `Bot` facade over an event bus.

## Install

```sh
pnpm add habbo-origins-fishing-toolkit
```

## Quick start

```ts
import { Bot } from 'habbo-origins-fishing-toolkit';

const bot = new Bot('email@example.com', 'password', 'hhous');

// Login succeeded — fetch our own account info before doing anything else.
bot.eventBus.on('LOGIN_OK', () => {
  bot.requestOwnInfo();
});

// Own account info resolved — now safe to navigate to a room.
bot.eventBus.on('OWN_INFO', () => {
  bot.moveToRoom(26);
});

// Room entered — pull the heightmap and occupant roster to start reasoning
// about the room (nearest fish, walkable tiles, etc).
bot.eventBus.on('ROOM_ENTERED', () => {
  bot.requestHeightmap();
  bot.requestUsers();
});

// A fishing chat balloon arrived — your bot logic goes here (detect a catch,
// track XP, react to a system notice...).
bot.eventBus.on('FISH_CAUGHT_MSG', (userId, chatMsg, iconID) => {
  console.log(`[${userId}] ${chatMsg} (icon ${iconID})`);
});

// Nothing above runs until connect() resolves the transport and handshake —
// listeners must be wired up first, since LOGIN_OK/OTP_REQUIRED/etc. can fire
// as soon as it does.
await bot.connect();
```

## API

### `new Bot(email, password, hotel?, options?)`

| Param      | Type                                       | Default                | Notes                                             |
| ---------- | ------------------------------------------ | ---------------------- | ------------------------------------------------- |
| `email`    | `string`                                   | —                      | Account login                                     |
| `password` | `string`                                   | —                      | Account password                                  |
| `hotel`    | `Hotels` (`'hhous' \| 'hhoes' \| 'hhobr'`) | `'hhous'`              | Which hotel to connect to                         |
| `options`  | `{ logPackets?: boolean }`                 | `{ logPackets: true }` | Set `false` to disable the built-in packet logger |

### `Bot` methods

| Method                             | Description                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect()`                        | Connects to the configured hotel and starts the session. Call once.                                                                                                                                                       |
| `submitOtp(code: string)`          | Answers an `OTP_REQUIRED` with the received code. No-op before `connect()` or outside a valid OTP context.                                                                                                                |
| `moveToRoom(flatId: number)`       | Requests navigation to a specific room. No-op before `connect()` or before login.                                                                                                                                         |
| `requestHeightmap()`               | Requests the current room's heightmap. No-op before `connect()` or before the room is confirmed entered.                                                                                                                  |
| `requestUsers()`                   | Requests the current room's occupant roster — fires `USERS_UPDATED`. No-op before `connect()` or before the room is confirmed entered.                                                                                    |
| `requestOwnInfo()`                 | Requests our own account info — fires `OWN_INFO`. No-op before `connect()` or before login. Not room-scoped, safe to call once right after `LOGIN_OK`.                                                                    |
| `requestFishingStats()`            | Requests our own fishing stats (level, XP, catch counts). No-op before `connect()` or before the room is confirmed entered.                                                                                               |
| `isRoomEntered()`                  | Whether the last requested room has been confirmed entered. `false` before `connect()`.                                                                                                                                   |
| `me()`                             | Our own current state in the room (`Me`: id, accountId, name, x, y, height, actions), position/actions kept fresh from the latest `STATUS`. `undefined` until `requestOwnInfo()` and `requestUsers()` have both resolved. |
| `move(x: number, y: number)`       | Walks the bot's own avatar to a tile. No-op before `connect()` or before the room is confirmed entered. Fire-and-forget — arrival isn't confirmed here, read it back from `me()`/`STATUS_UPDATED`.                        |
| `startFishing(fishingId: number)`  | Casts the line on the given active object id. No-op before `connect()` or before the room is confirmed entered.                                                                                                           |
| `getFishingAction(userId: number)` | The fishing action (`FishingAction`: x, y, height, state) of the given room occupant, if currently fishing — works for any tracked user, not just the bot itself. `undefined` otherwise.                                  |
| `getMoveAction(userId: number)`    | The move action (`MoveAction`: x, y, height) of the given room occupant, if currently walking — works for any tracked user, not just the bot itself. `undefined` otherwise.                                               |

### Events (`bot.eventBus.on(event, handler)`)

| Event                   | Payload                                                                                     | Fires when                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LOGIN_OK`              | —                                                                                           | Login succeeded                                                                                                                                                                                                                            |
| `OTP_REQUIRED`          | —                                                                                           | An OTP code is expected (answer via `bot.submitOtp(code)`)                                                                                                                                                                                 |
| `LOGIN_FAILED`          | `reason: string`                                                                            | Login was rejected                                                                                                                                                                                                                         |
| `ACCOUNT_BANNED`        | `reason: string`                                                                            | Account got banned — can happen at any time, not just during login                                                                                                                                                                         |
| `ROOM_ENTERED`          | `flatId: number`                                                                            | The room requested via `moveToRoom()` is confirmed reached                                                                                                                                                                                 |
| `HEIGHTMAP_RECEIVED`    | `data: string[]`                                                                            | Response to `requestHeightmap()`, one entry per map row                                                                                                                                                                                    |
| `ACTIVE_OBJECT_ADDED`   | `newObject: Readonly<ActiveRoomObject>, activeObjects: ReadonlyArray<ActiveRoomObject>`     | An active object (e.g. a fish) appears in the current room                                                                                                                                                                                 |
| `ACTIVE_OBJECT_REMOVED` | `objectRemoved: Readonly<ActiveRoomObject>, activeObjects: ReadonlyArray<ActiveRoomObject>` | An active object disappears from the current room                                                                                                                                                                                          |
| `STATUS_UPDATED`        | `status: ReadonlyArray<Status>`                                                             | Position/action of one or more room occupants changed; merged by `id` into the running list, not a full resync                                                                                                                             |
| `USERS_UPDATED`         | `users: ReadonlyArray<RoomUser>`                                                            | Response to `requestUsers()`, merged by `id` into the running roster (identity + initial position)                                                                                                                                         |
| `OWN_INFO`              | `ownInfo: Readonly<OwnUserInfo>`                                                            | Response to `requestOwnInfo()` — our own account info; not room-scoped, never cleared on room change                                                                                                                                       |
| `USER_DISCONNECTED`     | `userDisconnected: Readonly<RoomUser>, users: ReadonlyArray<RoomUser>`                      | A room occupant left; removed from the running roster                                                                                                                                                                                      |
| `STATUS_REMOVED`        | `statusRemoved: Readonly<Status>, status: ReadonlyArray<Status>`                            | Same departure, removed from the running position/action list                                                                                                                                                                              |
| `FISH_CAUGHT_MSG`       | `userId: number, chatMsg: string, iconID: number`                                           | A fishing chat balloon arrived — not necessarily a catch (system notices and Fishing Frenzy announcements share this event too); `iconID` semantics aren't in the client source (community convention: 1=normal catch, 2=golden, 0=system) |

### Helpers

Pure, stateless static classes — no network/protocol knowledge, take every piece of state as arguments, nothing remembered between calls.

**`AvatarActions`** — reads an avatar's current pose out of a `STATUS` entry's `actions` field.

| Method                                | Description                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| `getFishingAction(actions: string[])` | Parses the `fsh x,y,h,state` tag, if present. `undefined` if absent or malformed. |
| `getMoveAction(actions: string[])`    | Parses the `mv x,y,h` tag, if present. `undefined` if absent or malformed.        |

**`FishingNavigator`** — decides where to fish next.

| Method                                                                                           | Description                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `isWalkable(heightmap, x, y)`                                                                    | Whether the heightmap tile can be walked on.                                                      |
| `isOccupied(tile, otherPlayersStatus)`                                                           | Whether another player currently stands on the tile.                                              |
| `findNearestFish(currentPosition, activeObjects)`                                                | The closest `fish_area` active object by Manhattan distance.                                      |
| `findWalkableTileNear(target, heightmap, otherPlayersStatus, maxDistance, exclude?)`             | The closest free, walkable tile within range of a target.                                         |
| `isInRange(a, b, maxDistance)`                                                                   | Whether two points are within Chebyshev distance of each other.                                   |
| `findFishingTarget(currentPosition, activeObjects, heightmap, otherPlayersStatus, maxDistance?)` | Composes the above into a single decision: no fish found, already in range, or a tile to walk to. |

### Exported types

`Events`, `Hotels`, `RoomUser`, `Status`, `ActiveRoomObject`, `Me`, `OwnUserInfo`, `Point`, `FishingTarget`, `FishingAction`, `MoveAction`.

## Development

```sh
pnpm install
pnpm test        # vitest
pnpm lint         # eslint
pnpm format:check # prettier
pnpm build        # emit dist/ + .d.ts
```

Architecture: `src/core/` is the pure protocol engine (crypto, wire format, transport, connection) with no business logic. `src/app/` holds the public facade (`app/bot/bot.ts`), protocol-translation handlers (`app/handlers/*`, one per concern — room, users, player, handshake, keep-alive), and pure computation helpers (`app/helpers/*`). Handlers only ever subscribe to raw packets; cross-handler coordination happens by two handlers independently observing the same packet, never by referencing each other directly. `Bot` is the only class consumers are meant to touch.

## Protocol reference

Internal notes for anyone extending the handlers — not part of the public API.

### Known headers (incoming)

| Header | Name                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | `HELLO`                 |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1      | `SECRET_KEY`            |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3      | `OK`                    | login accepted                                                                                                                                                                                                                                                                                                                                                                                                       |
| 20     | `NO_LOGIN_PERMISSION`   | OTP required                                                                                                                                                                                                                                                                                                                                                                                                         |
| 33     | `LOGIN_ERROR`           |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 35     | `USER_BANNED`           | not login-only, can happen at any point in the session                                                                                                                                                                                                                                                                                                                                                               |
| 50     | `PING`                  |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 69     | `ROOM_READY`            |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 31     | `HEIGHTMAP`             |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 28     | `USERS`                 | full roster of room occupants (id, name, motto, figure, position...); requested via `G_USRS`, sent right after `ROOM_READY`                                                                                                                                                                                                                                                                                          |
| 34     | `STATUS`                | position/action deltas for room occupants, keyed by the same `id` as `USERS`; pushed by the server on its own — sending `G_STAT` (64) turned out to have no observed effect on it, so we dropped that request                                                                                                                                                                                                        |
| 5      | `USER_OBJECT`           | our own account info (id, name, figure, motto, badges/settings flags...); requested via `GET_INFO`                                                                                                                                                                                                                                                                                                                   |
| 29     | `USER_LOGGED_OUT`       | someone left the room; body is the bare id as literal decimal text, NOT a ShockwaveString (no 0x02 terminator) — don't use `PacketReader.str()` for this one                                                                                                                                                                                                                                                         |
| 93     | `ACTIVE_OBJECT_ADD`     |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 94     | `ACTIVE_OBJECT_REMOVE`  |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 277    | `BANNER`                |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1101   | `FISHING_CHAT`          | balloon message on the fishing channel: `userId:int, chatMsg:str, iconID:int`. Fires for catches AND non-catch system notices AND "FISHING FRENZY ACTIVATED" — the client doesn't encode icon meaning anywhere, it's an opaque asset lookup (`balloon.icon.<N>`); interpreting `iconID` (1=normal catch, 2=golden, 0=system, per community convention) is left to the consumer                                       |
| 1102   | `TOKENS_REFRESH`        | identified (`handle_fish_tokens`: single int, new fish-token balance), not consumed yet                                                                                                                                                                                                                                                                                                                              |
| 1107   | `GOLDEN_START`          | Golden fish minigame started. Body: `fishID:int, seconds:int`. **Not sent on every cast** — regular fish are caught passively via `FISHING_CHAT`(1101) alone, with no `1107`/`1108`/`1109` at all; this only fires when a golden fish bites. The server also doesn't always send it before `GOLDEN_STATUS` — sometimes the minigame starts directly on the first `1108`, so treat either as "minigame is now active" |
| 1108   | `GOLDEN_STATUS`         | Golden fish minigame tick. Body: `balance:int, barProgress:int, seconds:int` — `balance` is a needle that drifts toward one side; expected reply is outgoing `FHM`(1101, not yet added here) + `"L"`/`"R"` once `balance` crosses a `±3` threshold, debounced ~200ms, to keep the fish hooked                                                                                                                        |
| 1109   | `GOLDEN_END`            | no body — golden fish minigame ended (caught or missed, see the following `FISHING_CHAT` for the outcome)                                                                                                                                                                                                                                                                                                            |
| 88     | `STUFF_DATA_UPDATE`     | `handle_stuffdataupdate` — furniture "stuff data" update, identified, not consumed yet                                                                                                                                                                                                                                                                                                                               |
| 138    | `REMOVE_BUDDY`          | `handle_remove_buddy` — a buddy was removed from the friends list, identified, not consumed yet                                                                                                                                                                                                                                                                                                                      |
| 13     | `CONSOLE_UPDATE`        | registered under two different names in the decompiled client (`handle_console_update` in the Messenger handler, `handleFriendListUpdate` in the Friend List handler) — same header id in both, unresolved which one actually applies; identified, not consumed yet                                                                                                                                                  |
| 2      | `RIGHTS`                | login flow, right after `OK`; repeated strings until an empty one, the account's privileges                                                                                                                                                                                                                                                                                                                          |
| 19     | `OPC_OK`                | `ROOM_READY` equivalent, but only for private rooms                                                                                                                                                                                                                                                                                                                                                                  |
| 266    | `FIGURE_CHANGE`         | another occupant changed figure/outfit live: `userId:int, figure:str, sex:str, customInfo:str`                                                                                                                                                                                                                                                                                                                       |
| 680    | `BULLETIN_NOTIFICATION` | generic hotel notification channel (title/desc/image/colors/room); also reused for Derby registration and Fishing Frenzy announcements — detected by matching text patterns in the title/body, no dedicated field                                                                                                                                                                                                    |
| 3439   | `ROOM_USER_TITLES`      | batch of the little titles shown above room occupants (different from `USERS`'s roster): `count:int`, then per user `roomIndex:int` + an optional title string                                                                                                                                                                                                                                                       |
| 54     | `FLAT_INFO`             | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 142    | `AVAILABLE_INFO_PROPS`  | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 46     | `FLAT_PROPERTY`         | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 257    | `SESSION_PARAMS`        | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 3435   | `OWN_TITLE_UPDATE`      | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 3642   | `REWARD_TRACKS`         | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 24     | `SAY_MESSAGE`           | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 25     | `WHISPER_MESSAGE`       | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |
| 26     | `SHOUT_MESSAGE`         | identified, not consumed yet                                                                                                                                                                                                                                                                                                                                                                                         |

Headers `4` and `10` were investigated exhaustively (every `.cct` we could decompile, several passes) and have **no client-side handler anywhere** — very likely dead/legacy. Not worth adding.

### Known headers (outgoing)

| Header | Name                 | Notes                                                                                                                                                               |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2      | `ROOM_DIRECTORY`     |                                                                                                                                                                     |
| 4      | `LOGIN`              |                                                                                                                                                                     |
| 5      | `GAMEDATA`           |                                                                                                                                                                     |
| 6      | `RELEASE_TOKEN`      |                                                                                                                                                                     |
| 60     | `G_HMAP`             | requests `HEIGHTMAP`; sent on `ROOM_READY`                                                                                                                          |
| 61     | `G_USRS`             | requests `USERS`; sent on `ROOM_READY`, same timing as `G_HMAP`                                                                                                     |
| 7      | `GET_INFO`           | requests `USER_OBJECT`; sent once, right after login — not room-scoped                                                                                              |
| 1269   | `MOVE`               | walks the bot's own avatar. Body: `x:int, y:int, 0` — third field's purpose unconfirmed. Not in the decompiled client source we have; confirmed empirically instead |
| 1100   | `START_FISHING`      | casts the line on a specific fish. Body: `fishId:int` (the active object's id, parsed from string to int)                                                           |
| 1106   | `GET_FISHING_STATS`  | requests the bot's own fishing stats; response not parsed yet                                                                                                       |
| 181    | `INTERSTITIAL_SHOWN` |                                                                                                                                                                     |
| 196    | `PONG`               |                                                                                                                                                                     |
| 202    | `GENERATE_KEY`       |                                                                                                                                                                     |
| 206    | `CLIENT_INIT`        |                                                                                                                                                                     |

## Roadmap / TODO

Game features:

- [ ] Golden fish minigame — headers confirmed (`GOLDEN_START`/`GOLDEN_STATUS`/`GOLDEN_END`, 1107/1108/1109): send outgoing `FHM`(1101, not yet added) + `"L"`/`"R"` once `GOLDEN_STATUS`'s balance crosses a `±3` threshold, debounced ~200ms
- [ ] Derby registration — dedicated outgoing command `ATTEMPT_TO_REGISTER_FOR_DERBY`(1108), simpler than parsing `BULLETIN_NOTIFICATION`(680) text
- [ ] Fishing Frenzy handling — announced via `BULLETIN_NOTIFICATION`(680) text patterns (no dedicated header); needs duration parsing and a "frenzy active until" window
- [ ] Fishing stats / rod level display (`FISHING_STATS`, `FISHING_ROD_LEVEL` — identified, response headers not added yet)
- [ ] Token balance (`TOKENS_REFRESH`, 1102 — header identified, not wired up in `HabboPlayerManager`)
- [ ] Fish-o-pedia (`handle_update_fishpedia` exists in the decompiled client, never explored)
- [ ] Active effects/buffs tracking (own status effects, periodic refresh)
- [ ] Backpack/inventory tracking (`STUFF_DATA_UPDATE`(88) and related)

Reliability / robustness:

- [ ] Wire `AvatarActions`/`getFishingAction()`/`getMoveAction()` into an actual consuming loop as the authoritative "still fishing"/"still walking" signal, instead of position-comparison or timing
- [ ] A real continuous "find → walk → fish → detect it's over → repeat" loop for consumers to build on (there is currently no bundled example/CLI — the package only exposes the primitives)
- [ ] Timeout/retry safety net if movement gets stuck (tile taken over mid-walk, no arrival ever detected)
- [ ] Socket/connection lifecycle handling (detect disconnect, reconnect) — confirmed root cause of at least one crash: `NodeSocketAdapter`/`Socket` only wire up `'data'`, never `'error'`/`'close'`; an unhandled `'error'` on a Node `net.Socket` (e.g. `ECONNRESET` when the account logs in elsewhere and the server kills this session) crashes the whole process by design. The fix is adding `onError`/`onClose` to the `Socket` interface and wiring them through `HabboConnection`
- [ ] Verify `FISH_CAUGHT_MSG`'s `iconID` meaning (1=normal, 2=golden, 0=system) against something more solid than community convention — not in the client source

Identified but not consumed (no known need yet):

- [ ] `RIGHTS`(2), `OPC_OK`(19), `FIGURE_CHANGE`(266), `BULLETIN_NOTIFICATION`(680), `ROOM_USER_TITLES`(3439), `FLAT_INFO`(54), `AVAILABLE_INFO_PROPS`(142), `FLAT_PROPERTY`(46), `SESSION_PARAMS`(257), `OWN_TITLE_UPDATE`(3435), `REWARD_TRACKS`(3642), `SAY_MESSAGE`(24), `WHISPER_MESSAGE`(25), `SHOUT_MESSAGE`(26), `STUFF_DATA_UPDATE`(88), `REMOVE_BUDDY`(138), `CONSOLE_UPDATE`(13)
- [ ] Passive objects (`G_OBJS`) — deliberately skipped, no observed need for them so far
- [ ] `MOVE`'s third body parameter — purpose still unconfirmed
- [ ] Bot-level synchronous getters (`getActiveObjects()`, `getStatus()`, `getHeightmap()`) — state is currently push-only via events, consumers must accumulate it themselves
