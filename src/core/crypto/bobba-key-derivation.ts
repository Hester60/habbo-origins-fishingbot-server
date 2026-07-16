import ChachaCipher from './chacha-cipher.js';
import { hkdfSync } from 'node:crypto';
import { DerivedKeys } from '../../types.js';

const SALT = Buffer.from('BobbaXtraHKDFSalt');

/**
 * Turns the single Diffie-Hellman shared secret into 4 independent
 * ChaCha20 streams (one per direction × header/data channel), via HKDF.
 *
 * Both client and server run this exact same deterministic derivation with
 * the exact same inputs — the identical sharedSecret (guaranteed by DH) and
 * the same fixed public constants (SALT, digest, per-channel info string,
 * output length). No randomness happens here and none of these 4 derived
 * keys is ever transmitted: each side independently recomputes the same
 * result and lands on it by construction, not by exchange.
 *
 * The only thing that varies per channel is `info` — that's what makes 4
 * cryptographically unrelated outputs come out of the same input secret.
 */
export default class BobbaKeyDerivation {
  static derive(sharedSecret: Buffer): DerivedKeys {
    return {
      c2sData: BobbaKeyDerivation.deriveCipher(sharedSecret, 'bobba-c2s-data'),
      c2sHeader: BobbaKeyDerivation.deriveCipher(sharedSecret, 'bobba-c2s-header'),
      s2cData: BobbaKeyDerivation.deriveCipher(sharedSecret, 'bobba-s2c-data'),
      s2cHeader: BobbaKeyDerivation.deriveCipher(sharedSecret, 'bobba-s2c-header'),
    };
  }

  static deriveCipher(secret: Buffer, channel: string): ChachaCipher {
    const info: Buffer<ArrayBuffer> = Buffer.from(`BobbaXtra|${channel}`);
    const devired: Buffer<ArrayBuffer> = Buffer.from(hkdfSync('sha256', secret, SALT, info, 44));

    return new ChachaCipher(devired.subarray(0, 32), devired.subarray(32, 44));
  }
}
