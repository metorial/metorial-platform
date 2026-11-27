import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  AiToolPolicy,
  AiToolPolicyStatus,
  db,
  ID,
  Instance,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  findDetectionTool,
  getDetectionCatalog,
  type DetectionCatalogTool
} from '@metorial/model-catalog/detection';
import { visibleDetectionWhere } from '../lib/aiToolDetection';

export let aiToolPolicyStatuses = Object.values(AiToolPolicyStatus);

export type AiToolUsage = {
  toolKey: string;
  deviceCount: number;
  peopleCount: number;
  lastSeenAt: Date | null;
  running: boolean;
};

export type AiToolSummary = {
  tool: DetectionCatalogTool;
  policy: AiToolPolicy | null;
  policyStatus: AiToolPolicyStatus;
  usage: AiToolUsage | null;
};

let policyStatus = (
  policy: Pick<AiToolPolicy, 'status'> | null | undefined
): AiToolPolicyStatus => policy?.status ?? 'unreviewed';

class AiToolPolicyServiceImpl {
  async listTools(d: {
    instance: Pick<Instance, 'oid'>;
    policyStatuses?: AiToolPolicyStatus[];
    detected?: boolean;
  }): Promise<AiToolSummary[]> {
    let [usage, policies] = await Promise.all([
      this.getUsage({ instance: d.instance }),
      this.listPolicies({ instance: d.instance })
    ]);

    return getDetectionCatalog()
      .tools.map(tool => {
        let policy = policies.get(tool.key) ?? null;

        return {
          tool,
          policy,
          policyStatus: policyStatus(policy),
          usage: usage.get(tool.key) ?? null
        };
      })
      .filter(entry => !d.policyStatuses || d.policyStatuses.includes(entry.policyStatus))
      .filter(entry => d.detected === undefined || !!entry.usage == d.detected)
      .sort(
        (a, b) =>
          (b.usage?.deviceCount ?? 0) - (a.usage?.deviceCount ?? 0) ||
          a.tool.name.localeCompare(b.tool.name)
      );
  }

  async getTool(d: {
    instance: Pick<Instance, 'oid'>;
    toolKey: string;
  }): Promise<AiToolSummary> {
    let tool = this.assertKnownTool(d.toolKey);

    let [usage, policy] = await Promise.all([
      this.getUsage({ instance: d.instance, toolKey: tool.key }),
      db.aiToolPolicy.findUnique({
        where: { instanceOid_toolKey: { instanceOid: d.instance.oid, toolKey: tool.key } }
      })
    ]);

    return {
      tool,
      policy,
      policyStatus: policyStatus(policy),
      usage: usage.get(tool.key) ?? null
    };
  }

  async updatePolicy(d: {
    instance: Pick<Instance, 'oid'>;
    toolKey: string;
    auditScope: AuditScope;
    input: { status?: AiToolPolicyStatus; note?: string | null };
  }) {
    let tool = this.assertKnownTool(d.toolKey);

    await withTransaction(async db => {
      let previous = await db.aiToolPolicy.findUnique({
        where: { instanceOid_toolKey: { instanceOid: d.instance.oid, toolKey: tool.key } }
      });

      let status = d.input.status ?? policyStatus(previous);
      let note = d.input.note === undefined ? (previous?.note ?? null) : d.input.note;
      if (previous && previous.status == status && previous.note == note) return;

      let decision = {
        decidedAt: new Date(),
        decidedByActorOid: d.auditScope.organizationActorOid ?? null
      };

      let aiToolPolicy = await db.aiToolPolicy.upsert({
        where: { instanceOid_toolKey: { instanceOid: d.instance.oid, toolKey: tool.key } },
        create: {
          id: await ID.generateId('aiToolPolicy'),
          instanceOid: d.instance.oid,
          toolKey: tool.key,
          status,
          note,
          ...decision
        },
        update: { status, note, ...(previous?.status == status ? {} : decision) }
      });

      addAfterTransactionHook(() =>
        Fabric.fire('ai_tool.policy.updated:after', {
          aiToolPolicy,
          previousAiToolPolicy: previous,
          auditScope: d.auditScope
        })
      );
    });

    return await this.getTool({ instance: d.instance, toolKey: tool.key });
  }

  async listPolicies(d: { instance: Pick<Instance, 'oid'> }) {
    let policies = await withTransaction(
      async db => await db.aiToolPolicy.findMany({ where: { instanceOid: d.instance.oid } }),
      { ifExists: true }
    );

    return new Map(policies.map(policy => [policy.toolKey, policy]));
  }

  async getPolicyStatuses(d: { instance: Pick<Instance, 'oid'> }) {
    let policies = await this.listPolicies(d);

    return (toolKey: string) => policyStatus(policies.get(toolKey));
  }

  private async getUsage(d: { instance: Pick<Instance, 'oid'>; toolKey?: string }) {
    let detections = await db.consumerDeviceDetection.findMany({
      where: {
        instanceOid: d.instance.oid,
        ...(d.toolKey ? { toolKey: d.toolKey } : {}),
        ...visibleDetectionWhere({ excludeStale: true })
      },
      select: {
        toolKey: true,
        consumerDeviceOid: true,
        lastSeenAt: true,
        state: true,
        consumerDevice: { select: { consumerProfile: { select: { consumerOid: true } } } }
      }
    });

    let byTool = new Map<
      string,
      { devices: Set<bigint>; people: Set<bigint>; lastSeenAt: Date | null; running: boolean }
    >();
    for (let detection of detections) {
      let usage = byTool.get(detection.toolKey) ?? {
        devices: new Set<bigint>(),
        people: new Set<bigint>(),
        lastSeenAt: null,
        running: false
      };
      usage.devices.add(detection.consumerDeviceOid);
      usage.people.add(detection.consumerDevice.consumerProfile.consumerOid);
      if (!usage.lastSeenAt || detection.lastSeenAt > usage.lastSeenAt) {
        usage.lastSeenAt = detection.lastSeenAt;
      }
      usage.running ||= detection.state == 'running';
      byTool.set(detection.toolKey, usage);
    }

    return new Map(
      [...byTool].map(([toolKey, usage]): [string, AiToolUsage] => [
        toolKey,
        {
          toolKey,
          deviceCount: usage.devices.size,
          peopleCount: usage.people.size,
          lastSeenAt: usage.lastSeenAt,
          running: usage.running
        }
      ])
    );
  }

  private assertKnownTool(toolKey: string) {
    let tool = findDetectionTool(toolKey);
    if (!tool) throw new ServiceError(notFoundError('ai_tool', toolKey));

    return tool;
  }
}

export let aiToolPolicyService = Service.create(
  'aiToolPolicyService',
  () => new AiToolPolicyServiceImpl()
).build();
