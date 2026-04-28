import { KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { derToJose } from 'ecdsa-sig-formatter';
import { base64url, type JWSHeaderParameters, type JWTPayload } from 'jose';
import { env } from '../../env';

let kms =
  env.provider.DEFAULT_PROVIDER == 'aws.lambda' && env.deflector.DEFLECTOR_JWT_KMS_KEY_ID
    ? new KMSClient({
        region: env.lambda.LAMBDA_AWS_REGION,
        credentials:
          env.lambda.LAMBDA_AWS_ACCESS_KEY_ID && env.lambda.LAMBDA_AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.lambda.LAMBDA_AWS_ACCESS_KEY_ID,
                secretAccessKey: env.lambda.LAMBDA_AWS_SECRET_ACCESS_KEY
              }
            : undefined
      })
    : undefined;

export let createDeflectorToken = async (d: {
  functionId: string;
  functionVersionId: string;
  egressPolicy?: {
    allowedIps?: string[];
    allowedHosts?: string[];
  };
}) => {
  if (!kms || !env.deflector.DEFLECTOR_JWT_KMS_KEY_ID) return undefined;

  let now = Math.floor(Date.now() / 1000);
  let protectedHeader: JWSHeaderParameters = {
    alg: 'ES256',
    typ: 'JWT',
    kid: env.deflector.DEFLECTOR_JWT_KMS_KEY_ID
  };
  let payload: JWTPayload & {
    functionId: string;
    functionVersionId: string;
    allowedIps?: string[];
    allowedHosts?: string[];
  } = {
    aud: env.deflector.DEFLECTOR_JWT_AUDIENCE ?? 'deflector',
    sub: d.functionVersionId,
    functionId: d.functionId,
    functionVersionId: d.functionVersionId,
    iat: now,
    nbf: now - 30,
    exp: now + 5 * 60
  };

  if (d.egressPolicy?.allowedIps !== undefined) {
    payload.allowedIps = d.egressPolicy.allowedIps;
  }
  if (d.egressPolicy?.allowedHosts !== undefined) {
    payload.allowedHosts = d.egressPolicy.allowedHosts;
  }

  // jose.SignJWT requires an in-process private key. The Deflector key is held in
  // AWS KMS, so KMS must produce the signature over the compact JWS signing input.
  let signingInput = `${base64url.encode(JSON.stringify(protectedHeader))}.${base64url.encode(
    JSON.stringify(payload)
  )}`;

  let res = await kms.send(
    new SignCommand({
      KeyId: env.deflector.DEFLECTOR_JWT_KMS_KEY_ID,
      Message: Buffer.from(signingInput),
      MessageType: 'RAW',
      SigningAlgorithm: 'ECDSA_SHA_256'
    })
  );

  if (!res.Signature) throw new Error('KMS did not return a signature');

  return `${signingInput}.${derToJose(Buffer.from(res.Signature), 'ES256')}`;
};

export let getDeflectorProxyUrl = () => env.deflector.DEFLECTOR_PROXY_URL;
