import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  db,
  ID,
  withTransaction,
  type AgentTrackingIngestSource,
  type AgentTrackingIngestSourceStatus,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  agentTrackingSyncService,
  getAgentTracking,
  getAgentTrackingIngestPublicUrl,
  ignoreNotFound,
  toServiceFamily,
  type AgentTracking,
  type AgentTrackingCallOpts,
  type AgentTrackingClientFamily
} from '@metorial/module-agent-tracking-sync';
import { revokeIngestSourceQueue } from '../queues/revokeIngestSources';
import { issuedKeyContentPolicy } from '../lib/contentPolicy';
import { issueCallOpts, prepareIssue } from '../lib/issue';

let orphanRevokeCallOpts: AgentTrackingCallOpts = { timeoutMs: 3_000 };
let lastUsedAtCallOpts: AgentTrackingCallOpts = {
  timeoutMs: 2_000,
  retry: false,
  captureErrors: false
};

let ingestSourceInclude = {
  instance: { include: { organization: true } }
} as const;

type IngestSourceLastUse = {
  lastUsedAt: Date | null;
  lastUsedStatus: 'used' | 'never_used' | 'unknown';
};

type IngestSourceRecord = AgentTrackingIngestSource & {
  instance: Instance & { organization: Organization };
};

class AgentTrackingIngestSourceServiceImpl {
  async createIngestSource(d: {
    organization: Organization;
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    input: { name: string; clientFamily: AgentTrackingClientFamily };
  }) {
    let { agentTracking, ingestUrl } = await prepareIssue({
      organization: d.organization,
      project: d.project,
      instance: d.instance,
      entity: 'agent_tracking.ingest_source',
      beforeChange: () =>
        Fabric.fire('agent_tracking.ingest_source.created:before', {
          organization: d.organization,
          instance: d.instance,
          input: d.input,
          auditScope: d.auditScope
        })
    });

    let created = await agentTracking.ingestSource.create(
      {
        organizationId: d.organization.id,
        instanceId: d.instance.id,
        name: d.input.name,
        family: toServiceFamily(d.input.clientFamily),
        contentPolicy: issuedKeyContentPolicy
      },
      issueCallOpts
    );

    try {
      let ingestSource = await withTransaction(async db => {
        let ingestSource = await db.agentTrackingIngestSource.create({
          data: {
            id: await ID.generateId('agentTrackingIngestSource'),
            serviceIngestSourceId: created.id,
            name: d.input.name,
            clientFamily: d.input.clientFamily,
            secretRedacted: UnifiedApiKey.redact(created.secret),
            instanceOid: d.instance.oid
          },
          include: ingestSourceInclude
        });

        await Fabric.fire('agent_tracking.ingest_source.created:after', {
          ingestSource,
          auditScope: d.auditScope
        });

        // A missed backfill is caught by the daily reconcile; it must not cost the secret.
        addAfterTransactionHook(() =>
          agentTrackingSyncService.backfillRoster({ organization: d.organization })
        );

        return ingestSource;
      });

      return {
        ingestSource,
        secret: created.secret,
        ingestUrl,
        lastUsedAt: null,
        lastUsedStatus: 'never_used' as const
      };
    } catch (error) {
      await this.revokeUnmirroredIngestSource({
        agentTracking,
        organization: d.organization,
        serviceIngestSourceId: created.id
      });

      throw error;
    }
  }

  async getIngestSourceById(d: { instance: Instance; ingestSourceId: string }) {
    let ingestSource = await db.agentTrackingIngestSource.findFirst({
      where: { id: d.ingestSourceId, instanceOid: d.instance.oid },
      include: ingestSourceInclude
    });
    if (!ingestSource) {
      throw new ServiceError(notFoundError('agent_tracking.ingest_source', d.ingestSourceId));
    }

    return ingestSource;
  }

  async describeIngestSource(d: { ingestSource: IngestSourceRecord }) {
    let [view] = await this.describe([d.ingestSource]);

    return view!;
  }

  async listIngestSources(d: {
    instance: Instance;
    statuses?: AgentTrackingIngestSourceStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.agentTrackingIngestSource.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: d.statuses ? { in: d.statuses } : 'active'
            },
            include: ingestSourceInclude
          })
      )
    ).mapAll(ingestSources => this.describe(ingestSources));
  }

  async revokeIngestSource(d: { ingestSource: IngestSourceRecord; auditScope: AuditScope }) {
    let ingestSource = await withTransaction(async db => {
      let revoked = await db.agentTrackingIngestSource.updateMany({
        where: { oid: d.ingestSource.oid, status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() }
      });

      let ingestSource = await db.agentTrackingIngestSource.findUniqueOrThrow({
        where: { oid: d.ingestSource.oid },
        include: ingestSourceInclude
      });
      if (!revoked.count) return ingestSource;

      await Fabric.fire('agent_tracking.ingest_source.revoked:after', {
        ingestSource,
        previousIngestSource: d.ingestSource,
        auditScope: d.auditScope
      });

      addAfterTransactionHook(() =>
        revokeIngestSourceQueue.add(
          { ingestSourceId: ingestSource.id },
          { id: ingestSource.id }
        )
      );

      return ingestSource;
    });

    return await this.describeIngestSource({ ingestSource });
  }

  private async describe(ingestSources: IngestSourceRecord[]) {
    let ingestUrl = getAgentTrackingIngestPublicUrl();

    let lastUses = await Promise.all(
      ingestSources.map(ingestSource => this.fetchLastUse(ingestSource))
    );

    return ingestSources.map((ingestSource, index) => ({
      ingestSource,
      ingestUrl,
      ...lastUses[index]!,
      secret: null
    }));
  }

  // The time of last use is shown next to the key, never needed to act on it: reading and
  // revoking keys must keep working while the service cannot answer.
  private async fetchLastUse(ingestSource: IngestSourceRecord): Promise<IngestSourceLastUse> {
    let unknown = { lastUsedAt: null, lastUsedStatus: 'unknown' } as const;

    let agentTracking = getAgentTracking();
    if (!agentTracking) return unknown;

    try {
      let remote = await agentTracking.ingestSource.get(
        {
          organizationId: ingestSource.instance.organization.id,
          ingestSourceId: ingestSource.serviceIngestSourceId
        },
        lastUsedAtCallOpts
      );

      return remote.lastUsedAt
        ? { lastUsedAt: new Date(remote.lastUsedAt), lastUsedStatus: 'used' }
        : { lastUsedAt: null, lastUsedStatus: 'never_used' };
    } catch {
      return unknown;
    }
  }

  // The secret of a key without a mirror row is never returned, so nobody can use the key;
  // revoking it is housekeeping and must not hide the error that caused it.
  private async revokeUnmirroredIngestSource(d: {
    agentTracking: AgentTracking;
    organization: Organization;
    serviceIngestSourceId: string;
  }) {
    try {
      await ignoreNotFound(
        d.agentTracking.ingestSource.revoke(
          { organizationId: d.organization.id, ingestSourceId: d.serviceIngestSourceId },
          orphanRevokeCallOpts
        )
      );
    } catch {}
  }
}

export let agentTrackingIngestSourceService = Service.create(
  'agentTrackingIngestSourceService',
  () => new AgentTrackingIngestSourceServiceImpl()
).build();
