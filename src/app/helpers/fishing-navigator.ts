import { ActiveRoomObject, FishingTarget, Point, Status } from '../../types.js';

/**
 * Pure, stateless helpers for deciding where to fish next: locating the
 * nearest fish, checking tile walkability/occupancy, and finding a free
 * tile within range of a target. No network/protocol knowledge — every
 * piece of state it needs (heightmap, positions...) is passed in by the
 * caller on each call, nothing is remembered between calls.
 */
export default class FishingNavigator {
  static isWalkable(heightmap: string[], x: number, y: number): boolean {
    if (undefined === heightmap[y]) {
      return false;
    }

    const height: string | undefined = heightmap[y][x];

    if (undefined === height) {
      return false;
    }

    return 'x' !== height;
  }

  static isOccupied(tile: Point, otherPlayersStatus: ReadonlyArray<Status>): boolean {
    const { x: tileX, y: tileY } = tile;

    return otherPlayersStatus.some((s: Status) => {
      return tileX === s.x && tileY === s.y;
    });
  }

  static findNearestFish(
    currentPosition: Point,
    activeObjects: ReadonlyArray<ActiveRoomObject>,
  ): ActiveRoomObject | undefined {
    const fishes: ActiveRoomObject[] = activeObjects.filter(
      (o: ActiveRoomObject) => 'fish_area' === o.className,
    );
    let closestFish: ActiveRoomObject | undefined;
    let lastClosestDistance: number | undefined;

    fishes.forEach((fish: ActiveRoomObject) => {
      const distance = Math.abs(currentPosition.x - fish.x) + Math.abs(currentPosition.y - fish.y);

      if (undefined === lastClosestDistance || distance < lastClosestDistance) {
        lastClosestDistance = distance;
        closestFish = fish;
      }
    });

    return closestFish;
  }

  static findWalkableTileNear(
    target: Point,
    heightmap: string[],
    otherPlayersStatus: ReadonlyArray<Status>,
    maxDistance: number,
    exclude?: Point,
  ): Point | undefined {
    let walkableTileNear: Point | undefined;
    let lastClosestDistance: number | undefined;

    for (let dy = -maxDistance; dy <= maxDistance; dy++) {
      for (let dx = -maxDistance; dx <= maxDistance; dx++) {
        if (dx === 0 && dy === 0) {
          continue; // never the target tile itself
        }

        const x = target.x + dx;
        const y = target.y + dy;

        if (exclude && x === exclude.x && y === exclude.y) {
          continue;
        }

        if (!FishingNavigator.isWalkable(heightmap, x, y)) {
          continue;
        }

        if (FishingNavigator.isOccupied({ x, y }, otherPlayersStatus)) {
          continue;
        }

        const distance = Math.abs(dx) + Math.abs(dy);

        if (undefined === lastClosestDistance || distance < lastClosestDistance) {
          lastClosestDistance = distance;
          walkableTileNear = { x, y };
        }
      }
    }

    return walkableTileNear;
  }

  static isInRange(a: Point, b: Point, maxDistance: number): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));

    return distance <= maxDistance;
  }

  static findFishingTarget(
    currentPosition: Point,
    activeObjects: ReadonlyArray<ActiveRoomObject>,
    heightmap: string[],
    otherPlayersStatus: ReadonlyArray<Status>,
    maxDistance = 2,
  ): FishingTarget | undefined {
    const nearestFish: ActiveRoomObject | undefined = FishingNavigator.findNearestFish(
      currentPosition,
      activeObjects,
    );

    if (!nearestFish) {
      return undefined;
    }

    const x: number = nearestFish.x;
    const y: number = nearestFish.y;
    const fishPoint: Point = { x, y };

    if (FishingNavigator.isInRange(currentPosition, fishPoint, maxDistance)) {
      return {
        fish: nearestFish,
        alreadyInRange: true,
      };
    } else {
      const walkableTileNear = FishingNavigator.findWalkableTileNear(
        fishPoint,
        heightmap,
        otherPlayersStatus,
        maxDistance,
      );

      if (walkableTileNear) {
        return {
          fish: nearestFish,
          alreadyInRange: false,
          targetTile: walkableTileNear,
        };
      }

      return {
        fish: nearestFish,
        alreadyInRange: false,
        targetTile: undefined,
      };
    }
  }
}
