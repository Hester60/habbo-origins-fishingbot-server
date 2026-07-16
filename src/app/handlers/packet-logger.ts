import HabboConnection from '../../core/connection/habbo-connection.js';
import { ParsedPacket } from '../../types.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';

/**
 * Logs every packet (incoming and outgoing) on a connection to the console,
 * prefixed with the connection's uuid and a millisecond timestamp — lets
 * several simultaneous bot sessions be traced independently in shared log
 * output. Resolves header numbers to their names via IncomingHeaders /
 * OutgoingHeaders; falls back to UNKNOWN for anything not registered there.
 */
export default class PacketLogger {
  private readonly connectionId: string;

  constructor(habboConnection: HabboConnection) {
    this.connectionId = habboConnection.uuid;

    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      this.logIncomingPacket(parsedPacket.header);
    });

    habboConnection.subscribeOutgoing((parsedPacket: ParsedPacket) => {
      this.logOutgoingPacket(parsedPacket.header);
    });
  }

  private logIncomingPacket(header: number) {
    const entry = Object.entries(IncomingHeaders).find(([, value]) => value === header);
    console.log(
      `[${this.connectionId}] [${this.timestamp()}] [INCOMING] [${header}] [${entry ? entry[0] : 'UNKNOWN'}]`,
    );
  }

  private logOutgoingPacket(header: number) {
    const entry = Object.entries(OutgoingHeaders).find(([, value]) => value === header);
    console.log(
      `[${this.connectionId}] [${this.timestamp()}] [OUTGOING] [${header}] [${entry ? entry[0] : 'UNKNOWN'}]`,
    );
  }

  private timestamp(): string {
    const now = new Date();
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${now.toLocaleString()}.${ms}`;
  }
}
