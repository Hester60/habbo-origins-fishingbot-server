import HabboConnection from '../../core/connection/habbo-connection.js';
import PacketReader from '../../core/wire/packet-reader.js';
import PacketWriter from '../../core/wire/packet-writer.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';
import { ParsedPacket } from '../../types.js';

/**
 * Keeps the session alive once it's active: echoes back every PING with a
 * PONG carrying the same timestamp. Deliberately knows nothing about login
 * or encryption state — HabboConnection already handles framing correctly
 * regardless of phase, so this class only ever reacts to one header.
 */
export default class HabboKeepAlive {
  constructor(private readonly habboConnection: HabboConnection) {
    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      if (parsedPacket.header === IncomingHeaders.PING) {
        this.respondToPing(parsedPacket.body);
      }
    });
  }

  // Listeners

  private respondToPing(body: Buffer): void {
    const timestamp: string = new PacketReader(body).str();

    const pongPacket: Buffer = new PacketWriter(OutgoingHeaders.PONG)
      .str('0')
      .str(timestamp)
      .build();

    this.habboConnection.send(pongPacket);
  }
}
