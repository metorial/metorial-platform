import { base62 } from '@metorial/base62';
import { memo } from '@metorial/memo';

export type TokenKeys =
  | {
      privateKey: string | (() => Promise<CryptoKey> | CryptoKey);
      publicKey: string | (() => Promise<CryptoKey> | CryptoKey);
    }
  | {
      secret: string;
    };

type Signer = {
  sign: (data: string) => Promise<string>;
  verify: (data: string, signature: string) => Promise<boolean>;
};

let getSigner = (keys: TokenKeys): Signer => {
  if ('secret' in keys) {
    let keyMemo = memo(() =>
      crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(keys.secret),
        { name: 'HMAC', hash: { name: 'SHA-384' } },
        false,
        ['sign', 'verify']
      )
    );

    return {
      async sign(data) {
        let signature = await crypto.subtle.sign(
          { name: 'HMAC', hash: { name: 'SHA-384' } },
          await keyMemo(),
          new TextEncoder().encode(data)
        );

        return base62.encode(new Uint8Array(signature));
      },

      async verify(data, signature) {
        return crypto.subtle.verify(
          { name: 'HMAC', hash: { name: 'SHA-384' } },
          await keyMemo(),
          new Uint8Array(base62.decodeRaw(signature)),
          new TextEncoder().encode(data)
        );
      }
    };
  } else {
    let privateKeyMemo = memo(async () => {
      if (typeof keys.privateKey == 'string') {
        let data = JSON.parse(keys.privateKey) as any;

        return await crypto.subtle.importKey(
          'jwk',
          data,
          { name: data.kty == 'EC' ? 'ECDSA' : data.kty, namedCurve: data.crv },
          true,
          ['sign']
        );
      } else {
        return (await keys.privateKey()) as CryptoKey;
      }
    });

    let publicKeyMemo = memo(async () => {
      if (typeof keys.publicKey == 'string') {
        let data = JSON.parse(keys.publicKey) as any;

        return await crypto.subtle.importKey(
          'jwk',
          JSON.parse(keys.publicKey) as any,
          { name: data.kty == 'EC' ? 'ECDSA' : data.kty, namedCurve: data.crv },
          true,
          ['verify']
        );
      } else {
        return (await keys.publicKey()) as CryptoKey;
      }
    });

    return {
      async sign(data) {
        let key = await privateKeyMemo();

        let signature = await crypto.subtle.sign(
          { name: key.algorithm.name, hash: { name: 'SHA-384' } },
          key,
          new TextEncoder().encode(data)
        );

        return base62.encode(new Uint8Array(signature));
      },

      async verify(data, signature) {
        return crypto.subtle.verify(
          { name: 'ECDSA', hash: { name: 'SHA-384' } },
          await publicKeyMemo(),
          new Uint8Array(base62.decodeRaw(signature)),
          new TextEncoder().encode(data)
        );
      }
    };
  }
};

export class Tokens {
  private signer: Signer;
  constructor(readonly keys: TokenKeys) {
    this.signer = getSigner(keys);
  }

  async sign({ type, data, expiresAt }: { type: string; data: any; expiresAt?: Date }) {
    let token = `${type}_v1_${base62.encode(
      JSON.stringify({
        d: data,
        e: expiresAt?.getTime(),
        c: Date.now()
      })
    )}`;

    let signature = await this.signer.sign(token);
    return `${token}_${signature}`;
  }

  async verify({ token, expectedType }: { expectedType: string; token: string }) {
    let parts = token.split('_');
    if (parts.length < 4) return { verified: false as const };

    let signatureBase62 = parts.pop()!;
    let dataBase62 = parts.pop()!;
    let version = parts.pop()!;
    let type = parts.join('_');
    if (type != expectedType) return { verified: false as const };

    if (version != 'v1') return { verified: false as const };

    let main = `${type}_${version}_${dataBase62}`;

    let verified = await this.signer.verify(main, signatureBase62);
    if (!verified) return { verified: false as const };

    let data = JSON.parse(base62.decode(dataBase62));
    let expiresAt = data.e ? new Date(data.e) : null;
    if (expiresAt && expiresAt < new Date()) return { verified: false as const };

    let createdAt = new Date(data.c);

    return {
      verified: true as const,

      type,
      expiresAt,
      createdAt,
      data: data.d
    };
  }

  static decode(token: string) {
    let parts = token.split('_');
    if (parts.length < 4) return null;

    let dataBase62 = parts[parts.length - 2];
    return JSON.parse(base62.decode(dataBase62));
  }
}
