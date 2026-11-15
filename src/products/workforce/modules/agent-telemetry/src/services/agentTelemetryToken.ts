import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  db,
  ID,
  withTransaction,
  type AgentTelemetryIngestToken,
  type Consumer,
  type ConsumerDevice,
  type Instance
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { agentTelemetrySettings } from '../env';
import { getGroundstation, isAgentTelemetryEnabled } from '../lib/client';
import { revokeAgentTelemetryIngestToken } from '../lib/ingestToken';
import { upsertInstanceScope } from '../lib/scope';
import { revokeIngestTokenQueue } from '../queues/revokeTokens';
import { syncEntityQueue } from '../queues/syncEntity';

class AgentTelemetryTokenServiceImpl {
  async canIssueDeviceTokens() {
    return isAgentTelemetryEnabled() && !!agentTelemetrySettings.groundstationIngestPublicUrl;
  }

  async issueDeviceToken(d: {
    consumerDevice: Pick<ConsumerDevice, 'oid'>;
    auditScope: AuditScope;
  }) {
    let groundstation = this.requireGroundstation();
    let ingestUrl = this.requireIngestUrl();

    let consumerDevice = await db.consumerDevice.findUniqueOrThrow({
      where: { oid: d.consumerDevice.oid },
      include: {
        instance: { include: { organization: true, project: true } },
        consumerProfile: { include: { consumer: true } }
      }
    });
    if (consumerDevice.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({ message: 'This device is no longer signed in.' })
      );
    }

    let { instance } = consumerDevice;
    let { consumer } = consumerDevice.consumerProfile;

    await upsertInstanceScope({
      groundstation,
      organization: instance.organization,
      project: instance.project,
      instance
    });

    let created = await groundstation.ingestToken.create({
      organizationId: instance.organization.id,
      instanceId: instance.id,
      name: consumerDevice.name,
      userRef: consumer.id,
      deviceRef: consumerDevice.id,
      deviceMode: 'bound'
    });

    let ingestToken = await withTransaction(async db => {
      let previous = await db.agentTelemetryIngestToken.findMany({
        where: { consumerDeviceOid: consumerDevice.oid, status: 'active' },
        select: { id: true }
      });

      let ingestToken = await db.agentTelemetryIngestToken.create({
        data: {
          id: await ID.generateId('agentTelemetryIngestToken'),
          deviceMode: 'bound',
          groundstationIngestTokenId: created.id,
          name: consumerDevice.name,
          instanceOid: instance.oid,
          consumerOid: consumer.oid,
          consumerDeviceOid: consumerDevice.oid
        }
      });

      // Rotation must not lose the new secret, so the old tokens are revoked after commit.
      addAfterTransactionHook(() =>
        revokeIngestTokenQueue.addManyWithOps(
          previous.map(token => ({
            data: { ingestTokenId: token.id },
            opts: { id: token.id }
          }))
        )
      );

      await Fabric.fire('agent_telemetry.ingest_token.created:after', {
        ingestToken: { ...ingestToken, consumer, consumerDevice },
        replacedIngestTokenIds: previous.map(token => token.id),
        auditScope: d.auditScope
      });

      return ingestToken;
    });

    await syncEntityQueue.addMany([
      { type: 'consumer', id: consumer.id },
      { type: 'device', id: consumerDevice.id }
    ]);

    return {
      ingestToken,
      secret: created.secret,
      ingestUrl,
      expiresAt: created.expiresAt
    };
  }

  async issueServiceToken(d: {
    consumer: Consumer;
    instance: Instance;
    input: { name: string; tags?: { key: string; value: string }[] };
  }) {
    let groundstation = this.requireGroundstation();

    if (!d.consumer.isServiceAccount) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Only service accounts can get ingest tokens without a device.'
        })
      );
    }
    if (d.consumer.organizationOid != d.instance.organizationOid) {
      throw new ServiceError(
        badRequestError({ message: 'The service account belongs to another organization.' })
      );
    }

    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.instance.oid },
      include: { organization: true, project: true }
    });

    await upsertInstanceScope({
      groundstation,
      organization: instance.organization,
      project: instance.project,
      instance
    });

    let created = await groundstation.ingestToken.create({
      organizationId: instance.organization.id,
      instanceId: instance.id,
      name: d.input.name,
      userRef: d.consumer.id,
      deviceMode: 'ephemeral',
      tags: d.input.tags
    });

    let ingestToken = await db.agentTelemetryIngestToken.create({
      data: {
        id: await ID.generateId('agentTelemetryIngestToken'),
        deviceMode: 'ephemeral',
        groundstationIngestTokenId: created.id,
        name: d.input.name,
        instanceOid: instance.oid,
        consumerOid: d.consumer.oid
      }
    });

    await syncEntityQueue.add({ type: 'consumer', id: d.consumer.id });

    return { ingestToken, secret: created.secret };
  }

  async revokeIngestToken(d: { ingestToken: AgentTelemetryIngestToken }) {
    return await revokeAgentTelemetryIngestToken({
      groundstation: this.requireGroundstation(),
      ingestToken: d.ingestToken
    });
  }

  private requireGroundstation() {
    let groundstation = getGroundstation();
    if (!groundstation) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Agent telemetry is not configured.' })
      );
    }

    return groundstation;
  }

  private requireIngestUrl() {
    let ingestUrl = agentTelemetrySettings.groundstationIngestPublicUrl;
    if (!ingestUrl) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Agent telemetry is not configured.' })
      );
    }

    return ingestUrl;
  }
}

export let agentTelemetryTokenService = Service.create(
  'agentTelemetryTokenService',
  () => new AgentTelemetryTokenServiceImpl()
).build();
