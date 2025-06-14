import { generatePlainId } from '@metorial/id';
import { JWT } from '@metorial/jwt';

let secret = generatePlainId(32);
let id = generatePlainId(15);
let identifier = `https://${id}.runners.connect.metorial.com`;

export interface SessionToken {
  sessionId: string;
}

export let SessionTokens = {
  sign: (token: SessionToken) => {
    return JWT.sign(
      token,
      {
        issuer: identifier,
        audience: identifier,
        alg: 'HS256',
        expiresIn: '30d'
      },
      secret
    );
  },

  verify: async (token: string) => {
    let payload = await JWT.verify(
      token,
      {
        issuer: identifier,
        audience: identifier,
        alg: 'HS256'
      },
      secret
    );

    return payload as any as SessionToken;
  }
};
