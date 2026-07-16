import { FishingAction, MoveAction } from '../../types.js';

/**
 * Pure, stateless helpers for reading an avatar's current pose/activity out
 * of STATUS's `actions` field. Each STATUS carries the complete action list
 * for that instant (not a delta), so these just inspect the latest array —
 * no state to track between calls.
 */
export default class AvatarActions {
  static getFishingAction(actions: string[]): FishingAction | undefined {
    const fishingAction: string | undefined = actions.find((a: string) => a.startsWith('fsh '));

    if (!fishingAction) {
      return undefined;
    }

    const coordinates: string[] = fishingAction.slice('fsh '.length).split(',');

    if (coordinates.length !== 4) {
      return undefined;
    }

    const x: number = parseInt(coordinates[0], 10);
    const y: number = parseInt(coordinates[1], 10);
    const height: number = parseInt(coordinates[2], 10);
    const state: number = parseInt(coordinates[3], 10);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(height) || Number.isNaN(state)) {
      return undefined;
    }

    return { x, y, height, state };
  }

  static getMoveAction(actions: string[]): MoveAction | undefined {
    const moveAction: string | undefined = actions.find((a: string) => a.startsWith('mv '));

    if (!moveAction) {
      return undefined;
    }

    const coordinates: string[] = moveAction.slice('mv '.length).split(',');

    if (coordinates.length !== 3) {
      return undefined;
    }

    const x: number = parseInt(coordinates[0], 10);
    const y: number = parseInt(coordinates[1], 10);
    const height: number = parseInt(coordinates[2], 10);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(height)) {
      return undefined;
    }

    return { x, y, height };
  }
}
