import type { FunctionVersion } from '../../prisma/generated/client';
import { db } from '../db';
import { encryption } from '../encryption';

let isCryptoOperationError = (err: unknown) =>
  err instanceof Error && err.name === 'OperationError';

export let decryptFunctionVersionEnvironmentVariables = async (d: {
  functionVersion: FunctionVersion;
  encryptedEnvironmentVariables?: string;
}) => {
  let encryptedEnvironmentVariables =
    d.encryptedEnvironmentVariables ?? d.functionVersion.encryptedEnvironmentVariables;
  if (!encryptedEnvironmentVariables) {
    throw new Error('Function version environment variables are missing');
  }

  let decryptError: unknown;

  try {
    return JSON.parse(
      await encryption.decrypt({
        entityId: d.functionVersion.id,
        encrypted: encryptedEnvironmentVariables
      })
    ) as Record<string, string>;
  } catch (err) {
    if (!isCryptoOperationError(err)) throw err;
    decryptError = err;
  }

  if (!d.functionVersion.oid) throw decryptError;

  let deployment = await db.functionDeployment.findFirst({
    where: { functionVersionOid: d.functionVersion.oid },
    orderBy: { oid: 'desc' }
  });
  if (!deployment) throw decryptError;

  return JSON.parse(
    await encryption.decrypt({
      entityId: deployment.id,
      encrypted: encryptedEnvironmentVariables
    })
  ) as Record<string, string>;
};
