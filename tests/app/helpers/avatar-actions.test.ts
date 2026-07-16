import { describe, expect, it } from 'vitest';
import AvatarActions from '../../../src/app/helpers/avatar-actions.js';

describe('AvatarActions', () => {
  describe('getFishingAction()', () => {
    it('parses x, y, height and state from a fsh action', () => {
      expect(AvatarActions.getFishingAction(['fsh 23,17,0,1'])).toEqual({
        x: 23,
        y: 17,
        height: 0,
        state: 1,
      });
    });

    it('finds the fsh action alongside other actions', () => {
      expect(AvatarActions.getFishingAction(['talk', 'fsh 23,17,0,1'])).toEqual({
        x: 23,
        y: 17,
        height: 0,
        state: 1,
      });
    });

    it('returns undefined when no fsh action is present', () => {
      expect(AvatarActions.getFishingAction(['mv 23,17,0'])).toBeUndefined();
    });

    it('returns undefined for an empty actions list', () => {
      expect(AvatarActions.getFishingAction([])).toBeUndefined();
    });

    it('does not match on a prefix collision (e.g. "fshx")', () => {
      expect(AvatarActions.getFishingAction(['fshx 1,2,3,4'])).toBeUndefined();
    });

    it('returns undefined when the body has the wrong number of fields', () => {
      expect(AvatarActions.getFishingAction(['fsh 23,17,0'])).toBeUndefined();
    });

    it('returns undefined when a field is not a number', () => {
      expect(AvatarActions.getFishingAction(['fsh 23,17,x,1'])).toBeUndefined();
    });
  });

  describe('getMoveAction()', () => {
    it('parses x, y and height from a mv action', () => {
      expect(AvatarActions.getMoveAction(['mv 23,17,0'])).toEqual({ x: 23, y: 17, height: 0 });
    });

    it('finds the mv action alongside other actions', () => {
      expect(AvatarActions.getMoveAction(['mv 23,17,0', 'talk'])).toEqual({
        x: 23,
        y: 17,
        height: 0,
      });
    });

    it('returns undefined when no mv action is present', () => {
      expect(AvatarActions.getMoveAction(['sit 0,0'])).toBeUndefined();
    });

    it('returns undefined for an empty actions list', () => {
      expect(AvatarActions.getMoveAction([])).toBeUndefined();
    });

    it('returns undefined when the body has the wrong number of fields', () => {
      expect(AvatarActions.getMoveAction(['mv 23,17'])).toBeUndefined();
    });

    it('returns undefined when a field is not a number', () => {
      expect(AvatarActions.getMoveAction(['mv 23,x,0'])).toBeUndefined();
    });
  });
});
