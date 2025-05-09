// @ts-ignore
import * as jose from 'jose';

let normalizeKey = (key: jose.JWK | string) => {
  if (typeof key == 'string') return JSON.parse(key);
  return key;
};

export let importKey = async (secret: string | jose.JWK, alg: 'HS256' | 'RS256' | 'ES384') => {
  // @ts-ignore
  if (secret instanceof CryptoKey) return secret;

  if (alg == 'HS256' && secret) {
    return new TextEncoder().encode(secret as string);
  } else if (alg == 'ES384' && secret) {
    return await jose.importJWK(normalizeKey(secret) as jose.JWK, 'ES384');
  } else {
    return await jose.importJWK(normalizeKey(secret) as jose.JWK, 'RS256');
  }
};

export let JWT = {
  sign: async (
    data: any,
    opts: {
      issuer: string;
      audience: string[] | string;
      expiresIn?: string | number;
      alg: 'HS256' | 'RS256' | 'ES384';
    },
    secret: string | jose.JWK
  ) => {
    if (!secret) {
      throw new Error('Secret is required to sign JWT');
    }

    let jwt = new jose.SignJWT(data)
      .setProtectedHeader({ alg: opts.alg })
      .setIssuedAt()
      .setIssuer(opts.issuer)
      .setAudience(opts.audience);

    if (opts.expiresIn) {
      jwt = jwt.setExpirationTime(
        typeof opts.expiresIn == 'number'
          ? opts.expiresIn + Math.floor(Date.now() / 1000)
          : opts.expiresIn
      );
    }

    return await jwt.sign(await importKey(secret, opts.alg));
  },
  verify: async <T extends {}>(
    jwt: string,
    opts: {
      issuer?: string[] | string;
      audience?: string[] | string;
      alg: 'HS256' | 'RS256' | 'ES384';
    },
    secret: string | jose.JWK
  ) => {
    if (!secret) {
      throw new Error('Secret is required to sign JWT');
    }

    let { payload } = await jose.jwtVerify(jwt, await importKey(secret, opts.alg), {
      issuer: opts.issuer,
      audience: opts.audience
    });

    return payload as T & jose.JWTPayload;
  },
  decode: <T extends {}>(jwt: string) => {
    return jose.decodeJwt(jwt) as T & jose.JWTPayload;
  }
};
