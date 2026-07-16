import { randomBytes } from 'crypto';
import BigIntBytes from './big-int-bytes.js';
import modPow from './modPow.js';

const G = 23786635532332886537261431906453031264918297n;
const P =
  632158881801130885249042417232212770524741295422564233061391190031954228421232913648184592218883487397503624904102572293826728806813079n;

/**
 * Diffie-Hellman key exchange using the Habbo Origins protocol's fixed
 * G/P constants — runs once at connection handshake, before login, so both
 * sides can agree on a shared secret bigint without ever transmitting their
 * private key. That secret is then handed to key derivation (HKDF) to
 * produce the ChaCha20 streams that encrypt everything else.
 */
export default class DiffieHellman {
  constructor(private privateKey: bigint = DiffieHellman.generatePrivateKey()) {
    //
  }

  static generatePrivateKey(): bigint {
    return randomBytes(8).readBigUInt64BE();
  }

  get publicKey(): bigint {
    return modPow(G, this.privateKey, P);
  }

  computeSharedSecret(otherPublicKey: bigint): bigint {
    return modPow(otherPublicKey, this.privateKey, P);
  }

  computeSharedSecretBytes(otherPublicKey: bigint): Buffer {
    return BigIntBytes.toMinimalBytes(this.computeSharedSecret(otherPublicKey));
  }
}
