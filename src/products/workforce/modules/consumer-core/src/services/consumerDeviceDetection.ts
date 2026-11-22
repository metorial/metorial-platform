import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  AiToolPolicyStatus,
  ConsumerDevice,
  db,
  ID,
  Instance,
  OAuthToken,
  Prisma,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  detectionDisabledError,
  detectionObservedAt,
  diffDetections,
  normalizeFindings,
  visibleDetectionWhere,
  type DetectionFinding
} from '../lib/aiToolDetection';
import { aiToolPolicyService } from './aiToolPolicy';
import { consumerDeviceInclude } from './consumerDevice';

export let consumerDeviceDetectionStatuses = ['present', 'gone'] as const;

export type ConsumerDeviceDetectionStatus = (typeof consumerDeviceDetectionStatuses)[number];

export let consumerDeviceDetectionInclude = {
  consumerDevice: { include: { consumerProfile: { include: { consumer: true } } } }
} satisfies Prisma.ConsumerDeviceDetectionInclude;

class ConsumerDeviceDetectionServiceImpl {
  async reportDetections(d: {
    consumerDevice: ConsumerDevice;
    oauthToken: Pick<OAuthToken, 'oid'> | undefined;
    auditScope: AuditScope;
    input: {
      seq: number;
      generatedAt: Date;
      findings: DetectionFinding[];
    };
  }) {
    this.assertDeviceSignIn(d);
    this.assertDeviceActive(d.consumerDevice);

    let findings = normalizeFindings(d.input.findings);

    let applied = await withTransaction(async db => {
      // Locks are taken settings first, then the device, in the same order as turning
      // detection off, so a report either commits before the cleanup or sees detection off.
      let [settings] = await db.$queryRaw<{ aiToolDetectionEnabled: boolean }[]>`
        SELECT "aiToolDetectionEnabled"
        FROM "ConsumerDeviceSettings"
        WHERE "instanceOid" = ${d.consumerDevice.instanceOid}
        FOR SHARE
      `;
      if (!settings?.aiToolDetectionEnabled) {
        throw new ServiceError(detectionDisabledError());
      }

      // Claiming the sequence number locks the device row, so a repeated or older report
      // waits for this one and then finds nothing to claim. A report from a sign-in the
      // device no longer has can't claim it either.
      let claimed = await db.consumerDevice.updateMany({
        where: {
          oid: d.consumerDevice.oid,
          status: 'active',
          oauthTokenOid: d.oauthToken!.oid,
          OR: [{ detectionSeq: null }, { detectionSeq: { lt: d.input.seq } }]
        },
        data: { detectionSeq: d.input.seq }
      });

      let device = await db.consumerDevice.findUniqueOrThrow({
        where: { oid: d.consumerDevice.oid }
      });
      if (!claimed.count) {
        this.assertDeviceActive(device);
        return false;
      }

      let observedAt = detectionObservedAt({
        generatedAt: d.input.generatedAt,
        previousObservedAt: device.detectionReportedAt,
        now: new Date()
      });
      await db.consumerDevice.update({
        where: { oid: device.oid },
        data: { detectionReportedAt: observedAt }
      });

      let existing = await db.consumerDeviceDetection.findMany({
        where: { consumerDeviceOid: device.oid }
      });
      let diff = diffDetections({ existing, findings });

      await db.consumerDeviceDetection.createMany({
        data: await Promise.all(
          diff.created.map(async finding => ({
            id: await ID.generateId('consumerDeviceDetection'),
            consumerDeviceOid: device.oid,
            instanceOid: device.instanceOid,
            toolKey: finding.toolKey,
            state: finding.state,
            confidence: finding.confidence,
            signalKinds: finding.signalKinds,
            version: finding.version,
            firstSeenAt: observedAt,
            lastSeenAt: observedAt
          }))
        )
      });

      for (let { finding, detection } of diff.updated) {
        await db.consumerDeviceDetection.update({
          where: { oid: detection.oid },
          data: {
            state: finding.state,
            confidence: finding.confidence,
            signalKinds: finding.signalKinds,
            version: finding.version,
            lastSeenAt: observedAt,
            goneAt: null
          }
        });
      }

      await db.consumerDeviceDetection.updateMany({
        where: { oid: { in: diff.gone.map(detection => detection.oid) } },
        data: { goneAt: observedAt }
      });

      if (diff.added.length || diff.removed.length) {
        let consumerDevice = await db.consumerDevice.findUniqueOrThrow({
          where: { oid: device.oid },
          include: consumerDeviceInclude
        });

        addAfterTransactionHook(() =>
          Fabric.fire('consumer.device.detections.changed:after', {
            consumerDevice,
            added: diff.added,
            removed: diff.removed,
            auditScope: d.auditScope
          })
        );
      }

      return true;
    });

    let consumerDevice = await db.consumerDevice.findUniqueOrThrow({
      where: { oid: d.consumerDevice.oid },
      include: consumerDeviceInclude
    });

    return { applied, consumerDevice };
  }

  async listDetections(d: {
    instance: Pick<Instance, 'oid'>;
    consumerIds?: string[];
    consumerProfileIds?: string[];
    consumerDeviceIds?: string[];
    toolKeys?: string[];
    policyStatuses?: AiToolPolicyStatus[];
    statuses?: ConsumerDeviceDetectionStatus[];
  }) {
    let policyFilter = d.policyStatuses
      ? await this.policyToolKeyFilter({ instance: d.instance, statuses: d.policyStatuses })
      : undefined;
    let statuses = d.statuses ?? ['present'];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.consumerDeviceDetection.findMany({
            ...opts,
            where: {
              AND: [
                {
                  instanceOid: d.instance.oid,
                  ...visibleDetectionWhere({ includeGone: true })
                },
                {
                  consumerDevice: {
                    id: d.consumerDeviceIds ? { in: d.consumerDeviceIds } : undefined,
                    consumerProfile:
                      d.consumerProfileIds || d.consumerIds
                        ? {
                            id: d.consumerProfileIds
                              ? { in: d.consumerProfileIds }
                              : undefined,
                            consumer: d.consumerIds ? { id: { in: d.consumerIds } } : undefined
                          }
                        : undefined
                  }
                },
                d.toolKeys ? { toolKey: { in: d.toolKeys } } : {},
                policyFilter ?? {},
                {
                  OR: [
                    ...(statuses.includes('present') ? [{ goneAt: null }] : []),
                    ...(statuses.includes('gone') ? [{ goneAt: { not: null } }] : [])
                  ]
                }
              ]
            },
            include: consumerDeviceDetectionInclude
          })
      )
    );
  }

  // Tools without a policy row are unreviewed, so the filter can't be a plain join.
  private async policyToolKeyFilter(d: {
    instance: Pick<Instance, 'oid'>;
    statuses: AiToolPolicyStatus[];
  }): Promise<Prisma.ConsumerDeviceDetectionWhereInput> {
    let policies = [
      ...(await aiToolPolicyService.listPolicies({ instance: d.instance })).values()
    ];
    let decided = policies.filter(policy => policy.status != 'unreviewed');

    return {
      OR: [
        {
          toolKey: {
            in: decided
              .filter(policy => d.statuses.includes(policy.status))
              .map(policy => policy.toolKey)
          }
        },
        ...(d.statuses.includes('unreviewed')
          ? [{ toolKey: { notIn: decided.map(policy => policy.toolKey) } }]
          : [])
      ]
    };
  }

  // Only the device's own Metorial Desktop sign-in may speak for it, not another credential
  // of the same consumer.
  private assertDeviceSignIn(d: {
    consumerDevice: Pick<ConsumerDevice, 'oauthTokenOid'>;
    oauthToken: Pick<OAuthToken, 'oid'> | undefined;
  }) {
    if (
      !d.consumerDevice.oauthTokenOid ||
      d.oauthToken?.oid != d.consumerDevice.oauthTokenOid
    ) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This sign-in does not belong to an enrolled device.'
        })
      );
    }
  }

  private assertDeviceActive(consumerDevice: Pick<ConsumerDevice, 'status'>) {
    if (consumerDevice.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({ message: 'This device is no longer signed in.' })
      );
    }
  }
}

export let consumerDeviceDetectionService = Service.create(
  'consumerDeviceDetectionService',
  () => new ConsumerDeviceDetectionServiceImpl()
).build();
