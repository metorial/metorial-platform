import {
  db,
  type Organization,
  type Provider,
  type ProviderConnection
} from '@mtsrc/ai-gateway-db';
import { Events } from '@mtsrc/ai-gateway-events';
import { checkProviderConnection } from '@mtsrc/ai-gateway-providers';
import type { ConnectionCheckResult, ProviderCredentials } from '@mtsrc/ai-gateway-spec';
import { env } from '../env';
import { connectionInclude, secretOwnerOf, type ConnectionWithRelations } from './connection';
import { recordConnectionCheck, type ConnectionCheckTrigger } from './history';
import { readConnectionSecret } from './nebula';
import { applyCheckResult, type ConnectionCheckState } from './schedule';
import { getCachedCredentials } from './secretCache';

let hourMs = 60 * 60 * 1000;

export let checkIntervalMs = () => env.credentials.checkIntervalHours * hourMs;

type CheckableConnection = ProviderConnection & {
  provider: Provider;
  organization: Organization;
  instance: { id: string };
};

export let loadConnectionCredentials = async (connection: CheckableConnection) =>
  await getCachedCredentials(
    connection,
    async () =>
      await readConnectionSecret({
        owner: secretOwnerOf(connection),
        connectionId: connection.id,
        nebulaSecretId: connection.nebulaSecretId,
        note: 'ai-gateway provider request'
      })
  );

export let runProviderCheck = async (d: {
  providerSlug: string;
  credentials: ProviderCredentials;
  config: ProviderConnection['config'];
}) => {
  let startedAt = Date.now();
  let result = await checkProviderConnection(d);

  return { result, checkedAt: new Date(startedAt), durationMs: Date.now() - startedAt };
};

export let recordCheck = async (d: {
  connection: CheckableConnection;
  trigger: ConnectionCheckTrigger;
  result: ConnectionCheckResult;
  checkedAt: Date;
  durationMs: number;
}) =>
  await recordConnectionCheck({
    connection: d.connection,
    providerSlug: d.connection.provider.slug,
    organizationId: d.connection.organization.id,
    instanceId: d.connection.instance.id,
    trigger: d.trigger,
    result: d.result,
    checkedAt: d.checkedAt,
    durationMs: d.durationMs
  });

export let checkStateUpdate = (d: {
  current: ConnectionCheckState;
  result: ConnectionCheckResult;
  checkedAt: Date;
}) =>
  applyCheckResult({
    current: d.current,
    result: d.result,
    now: d.checkedAt,
    checkIntervalMs: checkIntervalMs()
  });

export let recheckConnection = async (d: {
  connection: ConnectionWithRelations;
  trigger: ConnectionCheckTrigger;
}) => {
  if (d.connection.archivedAt || d.connection.status == 'disabled') return d.connection;

  let credentials = await loadConnectionCredentials(d.connection);
  let check = await runProviderCheck({
    providerSlug: d.connection.provider.slug,
    credentials,
    config: d.connection.config
  });

  let connection = await db.providerConnection.update({
    where: { oid: d.connection.oid },
    data: checkStateUpdate({
      current: d.connection,
      result: check.result,
      checkedAt: check.checkedAt
    }),
    include: connectionInclude
  });

  await recordCheck({ connection, trigger: d.trigger, ...check });

  if (connection.status != d.connection.status) {
    await Events.fire('credentials.connection.changed:after', {
      connectionId: connection.id,
      instanceId: connection.instance.id,
      change: 'status_changed'
    });
  }

  return connection;
};
