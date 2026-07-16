const CROCKFORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a well-formed but meaningless release token — the server never
 * actually validates its content, only that it looks like BX1-XXXX-XXXX-
 * XXXX-XXXX-XXXX (Crockford base32, no I/O/0/1 to avoid visual confusion).
 * A fresh random one per connection means there's nothing to capture or
 * keep refreshed, unlike a real captured token which can go stale.
 */
export default function generateReleaseToken(): string {
  const GROUPS = 5;
  const GROUP_SIZE = 4;

  const groups: string[] = [];

  for (let i = 0; i < GROUPS; i++) {
    let group = '';

    for (let j = 0; j < GROUP_SIZE; j++) {
      const index = Math.floor(Math.random() * CROCKFORD_ALPHABET.length);
      group += CROCKFORD_ALPHABET[index];
    }

    groups.push(group);
  }

  return `BX1-${groups.join('-')}`;
}
