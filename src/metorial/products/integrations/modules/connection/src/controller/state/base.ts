import { db } from '@metorial-subspace/db';
import { isRecordDeleted } from '@metorial-subspace/list-utils';

export let getConnectionBaseState = async (d: {
  connectionOid: bigint;
  instanceOid: bigint;
}) => {
  let connection = await db.sessionConnection.findFirst({
    where: { oid: d.connectionOid },
    include: { participant: true }
  });

  let instance = await db.sessionProviderInstance.findFirst({
    where: { oid: d.instanceOid },
    include: {
      sessionProvider: {
        include: {
          deployment: true,
          session: true,
          tenant: true,
          provider: true,
          config: { include: { currentVersion: true } },
          authConfig: { include: { currentVersion: true } }
        }
      },
      pairVersion: {
        include: {
          version: {
            include: {
              provider: true,
              backend: true,
              providerVariant: true,

              slate: true,
              slateVersion: true,

              shuttleServer: true,
              shuttleServerVersion: true
            }
          }
        }
      }
    }
  });
  if (!instance) {
    console.warn(`No session provider instance found for oid: ${d.instanceOid}`);
    return;
  }
  if (!connection) {
    console.warn(`No session client found for oid: ${d.connectionOid}`);
    return;
  }

  let participant = connection.participant;
  if (!participant) {
    console.warn(`No participant found for connection id: ${connection.id}`);
    return;
  }

  let pairVersion = instance.pairVersion;
  let version = pairVersion.version;
  if (version.backend.type === 'slates' && (!version.slate || !version.slateVersion)) {
    console.warn(
      `Session provider instance ${instance.id} is missing slate or slate version association`
    );
    return;
  }

  if (
    version.backend.type === 'shuttle' &&
    (!version.shuttleServer || !version.shuttleServerVersion)
  ) {
    console.warn(
      `Session provider instance ${instance.id} is missing shuttle server or shuttle server version association`
    );
    return;
  }

  let sessionProvider = instance.sessionProvider;
  let session = instance.sessionProvider.session;
  let provider = sessionProvider.provider;
  let backend = version.backend;

  let anyRecordDeleted =
    isRecordDeleted(provider) ||
    isRecordDeleted(sessionProvider) ||
    isRecordDeleted(session) ||
    isRecordDeleted(sessionProvider.deployment) ||
    isRecordDeleted(sessionProvider.config) ||
    isRecordDeleted(sessionProvider.authConfig);
  if (anyRecordDeleted) return;

  return {
    connection,
    participant,
    instance,
    session,
    version,
    provider,
    backend,
    sessionProvider
  };
};

export type ConnectionBaseState = NonNullable<
  Awaited<ReturnType<typeof getConnectionBaseState>>
>;
