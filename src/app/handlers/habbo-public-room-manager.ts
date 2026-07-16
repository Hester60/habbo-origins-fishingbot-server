import HabboConnection from '../../core/connection/habbo-connection.js';
import { Events, ParsedPacket, ActiveRoomObject } from '../../types.js';
import { IncomingHeaders, OutgoingHeaders } from '../../core/protocol/headers.js';
import EventBus from './event-bus.js';
import PacketWriter from '../../core/wire/packet-writer.js';
import PacketReader from '../../core/wire/packet-reader.js';

/**
 * Owns everything room-related on the connection, scoped to public fishing
 * rooms specifically: requesting to navigate to a specific room, and
 * retrieving that room's content (heightmap, active objects like fish).
 * Private rooms (full furniture editing, passive objects, etc.) are a
 * different subsystem, not covered here. Publishes clean business events
 * on the shared EventBus — callers never see the raw protocol headers
 * behind them.
 */
export default class HabboPublicRoomManager {
  private lastRequestedFlatId: number | undefined;
  private roomEntered: boolean = false;
  private activeRoomObjects: ActiveRoomObject[] = [];

  private readonly packetHandlers: Map<number, (body: Buffer) => void> = new Map([
    [IncomingHeaders.ROOM_READY, (body: Buffer) => this.onRoomReady(body)],
    [IncomingHeaders.HEIGHTMAP, (body: Buffer) => this.onHeightmap(body)],
    [IncomingHeaders.ACTIVE_OBJECT_ADD, (body: Buffer) => this.onActiveObjectAdd(body)],
    [IncomingHeaders.ACTIVE_OBJECT_REMOVE, (body: Buffer) => this.onActiveObjectRemove(body)],
  ]);

  constructor(
    private readonly habboConnection: HabboConnection,
    private readonly eventBus: EventBus<Events>,
  ) {
    habboConnection.subscribeIncoming((parsedPacket: ParsedPacket) => {
      this.packetHandlers.get(parsedPacket.header)?.(parsedPacket.body);
    });
  }

  public moveToRoom(flatId: number): void {
    if (this.habboConnection.isLoggedIn() && this.habboConnection.isEncrypted()) {
      this.roomEntered = false;
      this.lastRequestedFlatId = flatId;
      this.sendRoomDirectoryPacket(flatId);
    }
  }

  public requestHeightmap(): void {
    if (this.isRoomEntered()) {
      this.sendGHMapPacket();
    }
  }

  public isRoomEntered(): boolean {
    return this.roomEntered;
  }

  // Packets

  private sendRoomDirectoryPacket(flatId: number): void {
    this.habboConnection.send(
      new PacketWriter(OutgoingHeaders.ROOM_DIRECTORY).int(1).int(flatId).int(0).build(),
    );
  }

  private sendGHMapPacket(): void {
    this.habboConnection.send(new PacketWriter(OutgoingHeaders.G_HMAP).build());
  }

  // Listeners

  private onRoomReady(body: Buffer): void {
    const descriptor = new PacketReader(body).str();
    const receivedFlatId = parseInt(descriptor.split(' ').pop()!, 10);
    this.activeRoomObjects = []; // Empty room objects array

    if (receivedFlatId === this.lastRequestedFlatId) {
      this.lastRequestedFlatId = undefined;
      this.roomEntered = true;
      this.eventBus.emit('ROOM_ENTERED', receivedFlatId);
    }
  }

  private onHeightmap(body: Buffer): void {
    const data: string = new PacketReader(body).str();
    this.eventBus.emit('HEIGHTMAP_RECEIVED', data.split('\r'));
  }

  private onActiveObjectAdd(body: Buffer): void {
    const packetReader: PacketReader = new PacketReader(body);
    const id: string = packetReader.str();
    const owner: number = packetReader.int();
    const className: string = packetReader.str();
    const x: number = packetReader.int();
    const y: number = packetReader.int();

    const newObject: ActiveRoomObject = {
      id,
      owner,
      className,
      x,
      y,
    };
    this.activeRoomObjects.push(newObject);
    this.eventBus.emit('ACTIVE_OBJECT_ADDED', { ...newObject }, [...this.activeRoomObjects]);
  }

  private onActiveObjectRemove(body: Buffer): void {
    const objectId: string = new PacketReader(body).str().trim();
    const index: number = this.activeRoomObjects.findIndex(
      (o: ActiveRoomObject) => o.id === objectId,
    );

    if (index > -1) {
      const removedRoomObject: ActiveRoomObject = { ...this.activeRoomObjects[index] };
      this.activeRoomObjects.splice(index, 1);
      this.eventBus.emit('ACTIVE_OBJECT_REMOVED', removedRoomObject, [...this.activeRoomObjects]);
    }
  }
}
