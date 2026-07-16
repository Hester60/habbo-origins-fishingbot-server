/**
 * Computes (base^exp) % mod using fast modular exponentiation.
 *
 * This algorithm avoids computing base^exp directly, which would become
 * prohibitively large for cryptographic exponents.
 *
 * @param base Base value.
 * @param exp Exponent.
 * @param mod Positive modulus.
 * @returns (base^exp) % mod
 */
export default function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;

  base = base % mod;

  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % mod;
    }

    exp >>= 1n;
    base = (base * base) % mod;
  }

  return result;
}
