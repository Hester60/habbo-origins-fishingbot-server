import HabboConnection from '../../core/connection/habbo-connection.js';
import PacketWriter from '../../core/wire/packet-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';
import { Events, ParsedPacket } from '../../types.js';
import PacketReader from '../../core/wire/packet-reader.js';
import EventBus from './event-bus.js';

/**
 * Sends action commands for the bot's own avatar (movement, fishing) and
 * observes their direct feedback (fishing chat messages). Fire-and-forget
 * for the outgoing side — it doesn't track position or confirm arrival;
 * that's read back from HabboUsersManager's STATUS tracking instead.
 */
export default class HabboPlayerManager {
  private readonly packetHandlers: Map<number, (body: Buffer) => void> = new Map([
    [IncomingHeaders.FISHING_CHAT, (body: Buffer) => this.onFishingChat(body)],
  ]);

  constructor(
    private readonly habboConnection: HabboConnection,
    private readonly eventBus: EventBus<Events>,
  ) {
    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      this.packetHandlers.get(parsedPacket.header)?.(parsedPacket.body);
    });
  }

  public move(x: number, y: number): void {
    this.sendMovePacket(x, y);
  }

  public startFishing(fishId: number): void {
    this.sendStartFishingPacket(fishId);
  }

  public requestFishingStats(): void {
    this.sendGetFishingStatsPacket();
  }

  // Packets

  private sendMovePacket(x: number, y: number): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.MOVE).int(x).int(y).int(0).build());
  }

  private sendStartFishingPacket(fishId: number): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.START_FISHING).int(fishId).build());
  }

  private sendGetFishingStatsPacket(): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.GET_FISHING_STATS).build());
  }

  // Listeners

  private onFishingChat(body: Buffer) {
    const packetReader: PacketReader = new PacketReader(body);
    const userId: number = packetReader.int();
    const chatMsg: string = packetReader.str();
    const iconID: number = packetReader.int();

    this.eventBus.emit('FISH_CAUGHT_MSG', userId, chatMsg, iconID);
  }
}
