import { describe, expect, it } from 'vitest';
import FishingNavigator from '../../../src/app/helpers/fishing-navigator.js';
import { ActiveRoomObject, Status } from '../../../src/types.js';

function fish(id: string, x: number, y: number): ActiveRoomObject {
  return { id, owner: -1, className: 'fish_area', x, y };
}

function sign(id: string, x: number, y: number): ActiveRoomObject {
  return { id, owner: -1, className: 'fish_sign', x, y };
}

function player(id: number, x: number, y: number): Status {
  return { id, x, y, height: 0, dirHead: 0, dirBody: 0, actions: [] };
}

function openHeightmap(size: number): string[] {
  return Array.from({ length: size }, () => '0'.repeat(size));
}

function blockedHeightmap(size: number): string[] {
  return Array.from({ length: size }, () => 'x'.repeat(size));
}

describe('FishingNavigator', () => {
  describe('isWalkable', () => {
    it('is walkable on a digit character', () => {
      expect(FishingNavigator.isWalkable(['05'], 0, 0)).toBe(true);
      expect(FishingNavigator.isWalkable(['05'], 1, 0)).toBe(true);
    });

    it('is not walkable on "x"', () => {
      expect(FishingNavigator.isWalkable(['x0'], 0, 0)).toBe(false);
    });

    it('is not walkable when y is out of bounds, without crashing', () => {
      expect(() => FishingNavigator.isWalkable(['00'], 0, -1)).not.toThrow();
      expect(FishingNavigator.isWalkable(['00'], 0, -1)).toBe(false);
      expect(FishingNavigator.isWalkable(['00'], 0, 5)).toBe(false);
    });

    it('is not walkable when x is out of bounds, without crashing', () => {
      expect(() => FishingNavigator.isWalkable(['00'], -1, 0)).not.toThrow();
      expect(FishingNavigator.isWalkable(['00'], -1, 0)).toBe(false);
      expect(FishingNavigator.isWalkable(['00'], 5, 0)).toBe(false);
    });
  });

  describe('isOccupied', () => {
    it('is occupied when a player is exactly on the tile', () => {
      expect(FishingNavigator.isOccupied({ x: 3, y: 4 }, [player(1, 3, 4)])).toBe(true);
    });

    it('is not occupied when no player is on the tile', () => {
      expect(FishingNavigator.isOccupied({ x: 3, y: 4 }, [player(1, 3, 5)])).toBe(false);
    });

    it('is not occupied when the player list is empty', () => {
      expect(FishingNavigator.isOccupied({ x: 3, y: 4 }, [])).toBe(false);
    });
  });

  describe('findNearestFish', () => {
    it('returns the closest fish_area by Manhattan distance', () => {
      const far = fish('1', 10, 10);
      const near = fish('2', 2, 1);
      const result = FishingNavigator.findNearestFish({ x: 0, y: 0 }, [far, near]);

      expect(result).toBe(near);
    });

    it('ignores active objects that are not fish_area', () => {
      const decoy = sign('1', 1, 1);
      const target = fish('2', 5, 5);
      const result = FishingNavigator.findNearestFish({ x: 0, y: 0 }, [decoy, target]);

      expect(result).toBe(target);
    });

    it('returns undefined when there is no fish_area at all', () => {
      const result = FishingNavigator.findNearestFish({ x: 0, y: 0 }, [sign('1', 1, 1)]);

      expect(result).toBeUndefined();
    });

    it('returns undefined for an empty list', () => {
      expect(FishingNavigator.findNearestFish({ x: 0, y: 0 }, [])).toBeUndefined();
    });
  });

  describe('findWalkableTileNear', () => {
    it('returns the closest walkable tile in an open area', () => {
      const heightmap = openHeightmap(12);
      const result = FishingNavigator.findWalkableTileNear({ x: 5, y: 5 }, heightmap, [], 2);

      expect(result).toEqual({ x: 5, y: 4 });
    });

    it('returns undefined when every tile around the target is blocked', () => {
      const heightmap = blockedHeightmap(12);
      const result = FishingNavigator.findWalkableTileNear({ x: 5, y: 5 }, heightmap, [], 1);

      expect(result).toBeUndefined();
    });

    it('returns undefined when every walkable tile around the target is occupied', () => {
      const heightmap = openHeightmap(12);
      const neighbours = [
        player(1, 4, 4),
        player(2, 5, 4),
        player(3, 6, 4),
        player(4, 4, 5),
        player(5, 6, 5),
        player(6, 4, 6),
        player(7, 5, 6),
        player(8, 6, 6),
      ];
      const result = FishingNavigator.findWalkableTileNear(
        { x: 5, y: 5 },
        heightmap,
        neighbours,
        1,
      );

      expect(result).toBeUndefined();
    });

    it('skips the excluded tile and returns the next best candidate', () => {
      const heightmap = openHeightmap(12);
      const result = FishingNavigator.findWalkableTileNear({ x: 5, y: 5 }, heightmap, [], 2, {
        x: 5,
        y: 4,
      });

      expect(result).toEqual({ x: 4, y: 5 });
    });

    it('does not crash when the search area spills off the edge of the heightmap', () => {
      const heightmap = openHeightmap(5);

      expect(() =>
        FishingNavigator.findWalkableTileNear({ x: 0, y: 0 }, heightmap, [], 2),
      ).not.toThrow();
      expect(FishingNavigator.findWalkableTileNear({ x: 0, y: 0 }, heightmap, [], 2)).toEqual({
        x: 1,
        y: 0,
      });
    });
  });

  describe('isInRange', () => {
    it('is in range for identical points', () => {
      expect(FishingNavigator.isInRange({ x: 5, y: 5 }, { x: 5, y: 5 }, 0)).toBe(true);
    });

    it('is in range exactly at maxDistance', () => {
      expect(FishingNavigator.isInRange({ x: 0, y: 0 }, { x: 3, y: 0 }, 3)).toBe(true);
    });

    it('is not in range one step beyond maxDistance', () => {
      expect(FishingNavigator.isInRange({ x: 0, y: 0 }, { x: 4, y: 0 }, 3)).toBe(false);
    });

    it('uses Chebyshev distance, not Manhattan, on a diagonal', () => {
      expect(FishingNavigator.isInRange({ x: 0, y: 0 }, { x: 3, y: 3 }, 3)).toBe(true);
    });
  });

  describe('findFishingTarget', () => {
    it('returns undefined when there is no fish in the room', () => {
      const heightmap = openHeightmap(12);
      const result = FishingNavigator.findFishingTarget({ x: 0, y: 0 }, [], heightmap, [], 2);

      expect(result).toBeUndefined();
    });

    it('reports alreadyInRange with no targetTile when the nearest fish is already reachable', () => {
      const heightmap = openHeightmap(12);
      const target = fish('1', 6, 5);
      const result = FishingNavigator.findFishingTarget({ x: 5, y: 5 }, [target], heightmap, [], 2);

      expect(result?.alreadyInRange).toBe(true);
      expect(result?.fish).toBe(target);
      expect(result?.targetTile).toBeUndefined();
    });

    it('returns a targetTile when the nearest fish is out of range but reachable', () => {
      const heightmap = openHeightmap(16);
      const target = fish('1', 10, 10);
      const result = FishingNavigator.findFishingTarget({ x: 0, y: 0 }, [target], heightmap, [], 2);

      expect(result?.alreadyInRange).toBe(false);
      expect(result?.fish).toBe(target);
      expect(result?.targetTile).toBeDefined();
    });

    it('returns an undefined targetTile when the nearest fish is out of range and fully blocked', () => {
      const heightmap = blockedHeightmap(16);
      const target = fish('1', 10, 10);
      const result = FishingNavigator.findFishingTarget({ x: 0, y: 0 }, [target], heightmap, [], 2);

      expect(result?.alreadyInRange).toBe(false);
      expect(result?.targetTile).toBeUndefined();
    });

    it('defaults maxDistance to 2 when omitted', () => {
      const heightmap = openHeightmap(12);
      const target = fish('1', 7, 5);
      const result = FishingNavigator.findFishingTarget({ x: 5, y: 5 }, [target], heightmap, []);

      expect(result?.alreadyInRange).toBe(true);
    });
  });
});
