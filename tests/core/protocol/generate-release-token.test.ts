import { describe, expect, it } from 'vitest';
import generateReleaseToken from '../../../src/core/protocol/generate-release-token.js';

describe('generateReleaseToken', () => {
  const TOKEN_REGEX =
    /^BX1-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

  it('generates a well-formed BX1-xxxx-xxxx-xxxx-xxxx-xxxx token, using only Crockford Base32 characters', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateReleaseToken()).toMatch(TOKEN_REGEX);
    }
  });

  it('does not always generate the same token', () => {
    const tokens = new Set<string>();

    for (let i = 0; i < 100; i++) {
      tokens.add(generateReleaseToken());
    }

    expect(tokens.size).toBeGreaterThan(1);
  });
});
