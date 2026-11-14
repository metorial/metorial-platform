import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import {
  commitWatermarkScan,
  createQueueCheckpoint,
  enqueueWatermarkScan,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import {
  isAutoGenerationEnabled,
  isSecurityReviewGenerationEnabled,
  securityReviewRequestId,
  securityReviewRequestQueue as requestQueue,
  type SecurityReviewRequest
} from '@metorial-subspace/module-security-review-request';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import { env } from '../env';
import { internalSecurityReviewSubjectService } from '../internal/securityReviewSubject';
import { enqueueSecurityReview, enqueueSecurityReviews } from './run';

let SCAN_BATCH_SIZE = 500;
let RECHECK_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
let SKILL_AI_WINDOW_MS = 6 * 60 * 60 * 1000;

let remoteProvenance = [
  'tenant_remote_vendor_verified',
  'tenant_remote_vendor_plausible',
  'tenant_remote_third_party',
  'tenant_remote_unverifiable',
  'impersonation_suspected'
];

let skillAiDelayMs = async (d: { reviewOid: bigint; skillCreatedAt: Date }) => {
  let lastAiRevision = await db.securityReviewRevision.findFirst({
    where: {
      reviewOid: d.reviewOid,
      mode: 'ai',
      status: { in: ['completed', 'completed_with_gaps'] }
    },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true }
  });

  let notBefore = Math.max(
    d.skillCreatedAt.getTime() + SKILL_AI_WINDOW_MS,
    lastAiRevision?.completedAt ? lastAiRevision.completedAt.getTime() + SKILL_AI_WINDOW_MS : 0
  );

  return Math.max(0, notBefore - Date.now());
};

let requestQueueProcessor = requestQueue.process(async job => {
  if (!isSecurityReviewGenerationEnabled('trigger' in job ? job.trigger : undefined)) return;

  if (job.subject == 'skill') {
    let review = await internalSecurityReviewSubjectService.ensureSkillReview({
      skillId: job.id
    });
    if (!review || review.status != 'active') return;
    if (review.dismissedAt && job.trigger != 'admin') return;

    let base = { reviewId: review.id, trigger: job.trigger, reason: job.reason };

    if (job.immediateAi) {
      await enqueueSecurityReview({ ...base, immediate: true });
      return;
    }

    let skill = await metorialDb.skill.findUnique({
      where: { id: job.id },
      select: { createdAt: true }
    });
    if (!skill) return;

    let delayMs = await skillAiDelayMs({
      reviewOid: review.oid,
      skillCreatedAt: skill.createdAt
    });

    if (delayMs == 0) {
      await enqueueSecurityReview({ ...base, immediate: true });
      return;
    }

    await enqueueSecurityReview({ ...base, immediate: true, deterministicOnly: true });
    await enqueueSecurityReview({ ...base, delayMs });
    return;
  }

  if (job.subject == 'customProviderVersion') {
    let version = await db.customProviderVersion.findUnique({ where: { id: job.id } });
    if (version?.status != 'deployment_succeeded') return;

    let review = await internalSecurityReviewSubjectService.ensureCustomProviderReview({
      customProviderVersionOid: version.oid
    });
    if (!review) return;

    await db.securityReview.updateMany({
      where: {
        oid: { not: review.oid },
        status: 'active',
        customProviderVersion: { customProviderOid: version.customProviderOid }
      },
      data: { status: 'outdated' }
    });

    await enqueueSecurityReview({
      reviewId: review.id,
      trigger: 'deployment',
      immediate: true
    });
    return;
  }

  if (job.subject == 'specChange') {
    let change = await db.providerVersionSpecificationChange.findUnique({
      where: { id: job.id },
      include: { toVersion: true }
    });
    if (!change) return;

    let sameVersion = change.fromVersionOid == change.toVersionOid;
    let previousWasReviewed =
      !sameVersion &&
      !!(await db.securityReview.findFirst({
        where: { scope: 'global', providerVersionOid: change.fromVersionOid },
        select: { oid: true }
      }));

    let request: SecurityReviewRequest = {
      subject: 'providerVersion',
      id: change.toVersion.id,
      trigger: sameVersion ? 'tools_discovered' : 'new_version',
      reason: sameVersion
        ? 'The tool definitions changed without a new version being published.'
        : 'A new version was published.',
      // A new version of a slate that was already reviewed (and so is in use) is
      // reviewed straight away; unused slates wait for first use or a page view.
      ensureSlate: previousWasReviewed
    };

    await requestQueue.add(request, { id: securityReviewRequestId(request) });
    return;
  }

  if (job.subject == 'provider') {
    let versions = await db.providerVersion.findMany({
      where: { provider: { id: job.id }, isCurrent: true, slateVersionOid: { not: null } },
      select: { id: true }
    });

    await requestQueue.addManyWithOps(
      versions.map(version => ({
        data: {
          subject: 'providerVersion' as const,
          id: version.id,
          trigger: 'first_use' as const,
          ensureSlate: true
        },
        opts: { id: `pv:${version.id}:first_use` }
      }))
    );
    return;
  }

  let providerVersion = await db.providerVersion.findUnique({
    where: { id: job.id },
    include: { slate: true }
  });
  if (!providerVersion) return;

  if (providerVersion.slateVersionOid) {
    let review = job.ensureSlate
      ? await internalSecurityReviewSubjectService.ensureSlateReview({
          providerVersionOid: providerVersion.oid
        })
      : await db.securityReview.findFirst({
          where: { providerVersionOid: providerVersion.oid, scope: 'global' }
        });
    if (!review) return;

    if (providerVersion.isCurrent && providerVersion.slate?.slateIdOnRegistry) {
      await securityReviewGlobalRepository.markOutdatedForSlate({
        slateRegistryId: providerVersion.slate.slateIdOnRegistry,
        exceptSubjectKey: review.subjectKey
      });
    }

    let hasReport = await db.securityReviewRevision.findFirst({
      where: { reviewOid: review.oid },
      select: { oid: true }
    });

    // Later spec changes and new versions trigger their own requests, so first use only
    // matters while there is no report at all.
    if (hasReport && job.trigger == 'first_use') return;

    await enqueueSecurityReview({
      reviewId: review.id,
      trigger: job.trigger,
      reason: job.reason,
      immediate: !hasReport
    });
    return;
  }

  let reviews = await db.securityReview.findMany({
    where: {
      providerVersionOid: providerVersion.oid,
      scope: 'tenant',
      status: { in: ['active', 'outdated'] }
    },
    select: { id: true }
  });

  await enqueueSecurityReviews(
    reviews.map(review => ({ reviewId: review.id, trigger: job.trigger, reason: job.reason }))
  );
});

let createWatermarkScanner = (d: {
  name: string;
  cron: string;
  scan: (
    job: WatermarkScanJob
  ) => Promise<{ lastId: string | null; requests: SecurityReviewRequest[] }>;
}) => {
  let checkpoint = createQueueCheckpoint({ db, queue: d.name });

  let manyQueue = createQueue<WatermarkScanJob>({
    name: `${d.name}/many`,
    redisUrl: env.service.REDIS_URL,
    workerOpts: { concurrency: 1 }
  });

  let cron = createCron(
    { name: `${d.name}/cron`, redisUrl: env.service.REDIS_URL, cron: d.cron },
    async () => {
      await enqueueWatermarkScan({ checkpoint, queue: manyQueue });
    }
  );

  let manyProcessor = manyQueue.process(async job => {
    let page = await d.scan(job);

    if (page.requests.length) {
      await requestQueue.addManyWithOps(
        page.requests.map(request => ({
          data: request,
          opts: { id: securityReviewRequestId(request) }
        }))
      );
    }

    if (page.lastId) {
      await manyQueue.add({ ...job, cursor: page.lastId }, hourlyPacedDelay());
      return;
    }

    await commitWatermarkScan({ checkpoint, job });
  });

  return combineQueueProcessors([cron, manyProcessor]);
};

let since = (job: WatermarkScanJob) => (job.since ? new Date(job.since) : undefined);

let fullPageLastId = (rows: { id: string }[]) =>
  rows.length == SCAN_BATCH_SIZE ? rows[rows.length - 1]!.id : null;

let deploymentScanner = createWatermarkScanner({
  name: 'sub/srev/scan/deployment',
  cron: '2 * * * *',
  scan: async job => {
    let versions = await db.customProviderVersion.findMany({
      where: {
        status: 'deployment_succeeded',
        updatedAt: since(job) ? { gte: since(job) } : undefined,
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SCAN_BATCH_SIZE,
      select: { id: true }
    });

    return {
      lastId: fullPageLastId(versions),
      requests: versions.map(version => ({
        subject: 'customProviderVersion' as const,
        id: version.id
      }))
    };
  }
});

let specChangeScanner = createWatermarkScanner({
  name: 'sub/srev/scan/spec-change',
  cron: '7 * * * *',
  scan: async job => {
    let changes = await db.providerVersionSpecificationChange.findMany({
      where: {
        createdAt: since(job) ? { gte: since(job) } : undefined,
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SCAN_BATCH_SIZE,
      select: { id: true }
    });

    return {
      lastId: fullPageLastId(changes),
      requests: changes.map(change => ({ subject: 'specChange' as const, id: change.id }))
    };
  }
});

let discoveryScanner = createWatermarkScanner({
  name: 'sub/srev/scan/discovery',
  cron: '12 * * * *',
  scan: async job => {
    let rows = await db.sessionConnectionProviderSpecification.findMany({
      where: {
        status: 'discovered',
        updatedAt: since(job) ? { gte: since(job) } : undefined,
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SCAN_BATCH_SIZE,
      select: { id: true, providerVersion: { select: { id: true, slateVersionOid: true } } }
    });

    let versionIds = new Set(
      rows
        .filter(row => !row.providerVersion.slateVersionOid)
        .map(row => row.providerVersion.id)
    );

    return {
      lastId: fullPageLastId(rows),
      requests: [...versionIds].map(id => ({
        subject: 'providerVersion' as const,
        id,
        trigger: 'census_changed' as const
      }))
    };
  }
});

let firstUseScanner = createWatermarkScanner({
  name: 'sub/srev/scan/first-use',
  cron: '22 * * * *',
  scan: async job => {
    let uses = await db.providerUse.findMany({
      where: {
        updatedAt: since(job) ? { gte: since(job) } : undefined,
        id: job.cursor ? { gt: job.cursor } : undefined,
        OR: [{ firstSessionAt: { not: null } }, { firstDeploymentAt: { not: null } }],
        provider: {
          providerVersions: { some: { isCurrent: true, slateVersionOid: { not: null } } }
        }
      },
      orderBy: { id: 'asc' },
      take: SCAN_BATCH_SIZE,
      select: { id: true, provider: { select: { id: true } } }
    });

    let providerIds = new Set(uses.map(use => use.provider.id));

    return {
      lastId: fullPageLastId(uses),
      requests: [...providerIds].map(id => ({ subject: 'provider' as const, id }))
    };
  }
});

let skillVersionScanner = createWatermarkScanner({
  name: 'sub/srev/scan/skill-version',
  cron: '27 * * * *',
  scan: async job => {
    let versions = await metorialDb.skillVersion.findMany({
      where: {
        createdAt: since(job) ? { gte: since(job) } : undefined,
        id: job.cursor ? { gt: job.cursor } : undefined,
        skill: { status: 'active' }
      },
      orderBy: { id: 'asc' },
      take: SCAN_BATCH_SIZE,
      select: { id: true, skill: { select: { id: true } } }
    });

    let skillIds = new Set(versions.map(version => version.skill.id));

    return {
      lastId: fullPageLastId(versions),
      requests: [...skillIds].map(id => ({
        subject: 'skill' as const,
        id,
        trigger: 'new_version' as const
      }))
    };
  }
});

let remoteRecheckCron = createCron(
  { name: 'sub/srev/remote/cron', redisUrl: env.service.REDIS_URL, cron: '17 3 * * *' },
  async () => {
    await remoteRecheckManyQueue.add({});
  }
);

let remoteRecheckManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/srev/remote/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let remoteRecheckManyProcessor = remoteRecheckManyQueue.process(async data => {
  if (!isAutoGenerationEnabled()) return;

  let cutoff = new Date(Date.now() - RECHECK_INTERVAL_MS);

  let reviews = await db.securityReview.findMany({
    where: {
      scope: 'tenant',
      status: 'active',
      isAdminDisabled: false,
      currentRevision: {
        provenanceClass: { in: remoteProvenance },
        completedAt: { lt: cutoff }
      },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }],
      id: data.cursor ? { gt: data.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: SCAN_BATCH_SIZE,
    select: { id: true }
  });

  await enqueueSecurityReviews(
    reviews.map(review => ({
      reviewId: review.id,
      trigger: 'scheduled' as const,
      reason: 'Routine re-check of the remote server and its vendor.',
      recheck: true,
      force: true
    }))
  );

  if (reviews.length == SCAN_BATCH_SIZE) {
    await remoteRecheckManyQueue.add(
      { cursor: reviews[reviews.length - 1]!.id },
      hourlyPacedDelay()
    );
  }
});

export let securityReviewTriggerProcessors = combineQueueProcessors([
  requestQueueProcessor,
  deploymentScanner,
  specChangeScanner,
  discoveryScanner,
  firstUseScanner,
  skillVersionScanner,
  remoteRecheckCron,
  remoteRecheckManyProcessor
]);
