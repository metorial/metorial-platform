import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  db,
  ID,
  withTransaction,
  type AgentTrackingIngestToken,
  type Consumer,
  type ConsumerDevice,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  agentTrackingSyncService,
  canIssueAgentTrackingKeys,
  requireAgentTracking
} from '@metorial/module-agent-tracking-sync';
import { issuedKeyContentPolicy } from '../lib/contentPolicy';
import { mirrorIngestToken, revokeAgentTrackingIngestToken } from '../lib/ingestToken';
import { issueCallOpts, issueInScope } from '../lib/issue';
import { revokeIngestTokenQueue } from '../queues/revokeTokens';

class AgentTrackingTokenServiceImpl {
  async listDeviceTelemetry(d: {
    organization: Organization;
    project: Project;
    consumerDevices: Pick<ConsumerDevice, 'oid' | 'status'>[];
  }) {
    let enabled = await canIssueAgentTrackingKeys({
      organization: d.organization,
      project: d.project
    });

    let signedInOids = enabled
      ? d.consumerDevices.filter(device => device.status == 'active').map(device => device.oid)
      : [];
    let tokens = signedInOids.length
      ? await db.agentTrackingIngestToken.findMany({
          where: {
            consumerDeviceOid: { in: signedInOids },
            status: 'active',
            deviceMode: 'bound'
          },
          orderBy: { oid: 'asc' },
          select: { consumerDeviceOid: true, serviceIngestTokenId: true }
        })
      : [];

    let activeTokenIds = new Map(
      tokens.map(token => [token.consumerDeviceOid!, token.serviceIngestTokenId])
    );

    return new Map(
      d.consumerDevices.map(device => [
        device.oid,
        { enabled, tokenId: activeTokenIds.get(device.oid) ?? null }
      ])
    );
  }

  async issueDeviceToken(d: {
    consumerDevice: Pick<ConsumerDevice, 'oid'>;
    auditScope: AuditScope;
  }) {
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

    let { agentTracking, created, ingestUrl } = await issueInScope({
      organization: instance.organization,
      project: instance.project,
      instance,
      entity: 'consumer.device.telemetry_token',
      create: agentTracking =>
        agentTracking.ingestToken.create(
          {
            organizationId: instance.organization.id,
            instanceId: instance.id,
            name: consumerDevice.name,
            userRef: consumer.id,
            deviceRef: consumerDevice.id,
            deviceMode: 'bound',
            contentPolicy: issuedKeyContentPolicy
          },
          issueCallOpts
        )
    });

    let ingestToken = await mirrorIngestToken(
      {
        agentTracking,
        organization: instance.organization,
        serviceIngestTokenId: created.id
      },
      () =>
        withTransaction(async db => {
          // Row lock, so two issues for one device replace each other's token.
          await db.$queryRaw`
            SELECT 1 FROM "ConsumerDevice" WHERE "oid" = ${consumerDevice.oid} FOR UPDATE
          `;

          let previous = await db.agentTrackingIngestToken.findMany({
            where: { consumerDeviceOid: consumerDevice.oid, status: 'active' },
            select: { id: true }
          });

          let ingestToken = await db.agentTrackingIngestToken.create({
            data: {
              id: await ID.generateId('agentTrackingIngestToken'),
              deviceMode: 'bound',
              serviceIngestTokenId: created.id,
              name: consumerDevice.name,
              instanceOid: instance.oid,
              consumerOid: consumer.oid,
              consumerDeviceOid: consumerDevice.oid
            }
          });

          // After commit, so neither the revokes nor a failed sync can cost the new secret.
          addAfterTransactionHook(() =>
            revokeIngestTokenQueue.addManyWithOps(
              previous.map(token => ({
                data: { ingestTokenId: token.id },
                opts: { id: token.id }
              }))
            )
          );
          addAfterTransactionHook(() =>
            agentTrackingSyncService.syncEntities({
              entities: [
                { type: 'consumer', id: consumer.id },
                { type: 'device', id: consumerDevice.id }
              ]
            })
          );

          await Fabric.fire('agent_tracking.ingest_token.created:after', {
            ingestToken: { ...ingestToken, consumer, consumerDevice },
            replacedIngestTokenIds: previous.map(token => token.id),
            auditScope: d.auditScope
          });

          return ingestToken;
        })
    );

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

    let { agentTracking, created } = await issueInScope({
      organization: instance.organization,
      project: instance.project,
      instance,
      entity: 'agent_tracking.ingest_token',
      create: agentTracking =>
        agentTracking.ingestToken.create(
          {
            organizationId: instance.organization.id,
            instanceId: instance.id,
            name: d.input.name,
            userRef: d.consumer.id,
            deviceMode: 'ephemeral',
            tags: d.input.tags,
            contentPolicy: issuedKeyContentPolicy
          },
          issueCallOpts
        )
    });

    let ingestToken = await mirrorIngestToken(
      {
        agentTracking,
        organization: instance.organization,
        serviceIngestTokenId: created.id
      },
      () =>
        withTransaction(async db => {
          let ingestToken = await db.agentTrackingIngestToken.create({
            data: {
              id: await ID.generateId('agentTrackingIngestToken'),
              deviceMode: 'ephemeral',
              serviceIngestTokenId: created.id,
              name: d.input.name,
              instanceOid: instance.oid,
              consumerOid: d.consumer.oid
            }
          });

          addAfterTransactionHook(() =>
            agentTrackingSyncService.syncEntities({
              entities: [{ type: 'consumer', id: d.consumer.id }]
            })
          );

          return ingestToken;
        })
    );

    return { ingestToken, secret: created.secret };
  }

  async revokeIngestToken(d: { ingestToken: AgentTrackingIngestToken }) {
    return await revokeAgentTrackingIngestToken({
      agentTracking: requireAgentTracking(),
      ingestToken: d.ingestToken
    });
  }
}

export let agentTrackingTokenService = Service.create(
  'agentTrackingTokenService',
  () => new AgentTrackingTokenServiceImpl()
).build();
