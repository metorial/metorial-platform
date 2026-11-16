import { v } from '@lowerdeck/validation';
import { db } from '@metorial/db';
import { type GetTypeOfPresentable, Presenter } from '@metorial/presenter';
import { skillSyncType } from '../../types';

let propagationEndReasons = [
  'superseded',
  'pull_request_closed',
  'pull_request_deleted',
  'branch_deleted'
] as const;

let waitingPropagationStatuses = ['pending', 'processing', 'waiting_for_review'];

type PropagationEndReason = (typeof propagationEndReasons)[number];

type SkillSyncRepositoryPropagation = GetTypeOfPresentable<
  typeof skillSyncType
>['skillSync']['repositoryPropagations'][number];

let skillSyncRepositoryPropagationSchema = v.object({
  object: v.literal('skill.sync_repository_propagation'),
  id: v.string(),
  status: v.enumOf([
    'pending',
    'processing',
    'waiting_for_review',
    'completed',
    'failed',
    'canceled'
  ]),
  repo_id: v.string(),
  repository_access_mode: v.enumOf(['pull_request', 'default_branch']),
  branch_name: v.string(),
  pr_name: v.string(),
  pr_description: v.nullable(v.string()),
  commit_message: v.nullable(v.string()),
  error_code: v.nullable(
    v.string({
      name: 'error_code',
      description:
        'Machine-readable reason a failed propagation stopped. Null unless the propagation failed.',
      examples: ['path_conflict', 'file_too_large', 'deletion_guard_tripped']
    })
  ),
  error_message: v.nullable(v.string()),
  unexpected_delete_count: v.nullable(
    v.number({
      name: 'unexpected_delete_count',
      description:
        'How many repository files the sync would have deleted that Metorial did not expect. Set when error_code is deletion_guard_tripped; forcing the sync with allow_mass_delete deletes them.',
      examples: [300]
    })
  ),
  waiting_until: v.nullable(
    v.date({
      name: 'waiting_until',
      description:
        'When a paused propagation resumes, for example after the provider rate limit resets. Null unless the propagation is waiting.'
    })
  ),
  waiting_reason: v.nullable(
    v.string({
      name: 'waiting_reason',
      description: 'Why the propagation is paused. Null unless it is waiting.',
      examples: ['rate_limited']
    })
  ),
  end_reason: v.nullable(
    v.enumOf([...propagationEndReasons], {
      name: 'end_reason',
      description:
        'Why a canceled propagation ended: it was continued by a newer sync, or its pull request or branch was closed or deleted in the repository.'
    })
  ),
  continued_in_sync_id: v.nullable(
    v.string({
      name: 'continued_in_sync_id',
      description:
        'The newer sync of the same marketplace or plugin that took over this propagation. Null unless end_reason is superseded.',
      examples: ['skds_7hNkPqRsTuVwXyZa']
    })
  ),
  created_at: v.date(),
  updated_at: v.date(),
  started_at: v.nullable(v.date()),
  completed_at: v.nullable(v.date())
});

let getEndReason = (propagation: SkillSyncRepositoryPropagation) =>
  (propagationEndReasons.find(reason => reason === propagation.endReason) ??
    null) as PropagationEndReason | null;

type SuccessorLookup = {
  propagationOid: bigint;
  skillRepositoryOid: bigint;
  destinationOid: bigint;
  resolve: (syncId: string | null) => void;
  reject: (error: unknown) => void;
};

let pendingSuccessorLookups: SuccessorLookup[] = [];

// Lookups from every sync presented in the same tick (a whole list page) share one query.
let flushSuccessorLookups = async () => {
  let lookups = pendingSuccessorLookups;
  pendingSuccessorLookups = [];

  try {
    let rows = await db.$queryRaw<{ propagationOid: bigint; syncId: string }[]>`
      SELECT lookup."propagationOid", successor_sync."id" AS "syncId"
      FROM unnest(
        ${lookups.map(lookup => lookup.propagationOid.toString())}::text[]::bigint[],
        ${lookups.map(lookup => lookup.skillRepositoryOid.toString())}::text[]::bigint[],
        ${lookups.map(lookup => lookup.destinationOid.toString())}::text[]::bigint[]
      ) AS lookup("propagationOid", "skillRepositoryOid", "destinationOid")
      CROSS JOIN LATERAL (
        SELECT propagation."skillDestinationSyncOid"
        FROM "SkillDestinationSyncRepositoryPropagation" propagation
        JOIN "SkillDestinationSync" sync ON sync."oid" = propagation."skillDestinationSyncOid"
        WHERE propagation."skillRepositoryOid" = lookup."skillRepositoryOid"
          AND sync."destinationOid" = lookup."destinationOid"
          AND propagation."oid" > lookup."propagationOid"
        ORDER BY propagation."oid" ASC
        LIMIT 1
      ) successor
      JOIN "SkillDestinationSync" successor_sync
        ON successor_sync."oid" = successor."skillDestinationSyncOid"
    `;
    let syncIdByPropagation = new Map(
      rows.map(row => [BigInt(row.propagationOid), row.syncId])
    );

    for (let lookup of lookups) {
      lookup.resolve(syncIdByPropagation.get(lookup.propagationOid) ?? null);
    }
  } catch (error) {
    for (let lookup of lookups) lookup.reject(error);
  }
};

let getContinuedInSyncId = (
  propagation: SkillSyncRepositoryPropagation,
  destinationOid: bigint
) =>
  new Promise<string | null>((resolve, reject) => {
    if (!pendingSuccessorLookups.length) setImmediate(flushSuccessorLookups);

    pendingSuccessorLookups.push({
      propagationOid: propagation.oid,
      skillRepositoryOid: propagation.skillRepositoryOid,
      destinationOid,
      resolve,
      reject
    });
  });

let presentRepositoryPropagation = async (
  propagation: SkillSyncRepositoryPropagation,
  destinationOid: bigint
) => {
  let isWaiting =
    !!propagation.waitingUntil && waitingPropagationStatuses.includes(propagation.status);
  let endReason = getEndReason(propagation);
  let continuedInSyncId =
    endReason === 'superseded'
      ? await getContinuedInSyncId(propagation, destinationOid)
      : null;

  return {
    object: 'skill.sync_repository_propagation' as const,
    id: propagation.id,
    status: propagation.status,
    repo_id: propagation.skillRepository.repoId,
    repository_access_mode: propagation.repositoryAccessMode,
    branch_name: propagation.branchName,
    pr_name: propagation.prName,
    pr_description: propagation.prDescription,
    commit_message: propagation.commitMessage,
    error_code: propagation.errorCode,
    error_message: propagation.errorMessage,
    unexpected_delete_count:
      propagation.errorCode === 'deletion_guard_tripped'
        ? (propagation.errorDetails?.unexpectedDeletes ??
          propagation.errorDetails?.total ??
          propagation.errorDetails?.paths?.length ??
          null)
        : null,
    waiting_until: isWaiting ? propagation.waitingUntil : null,
    waiting_reason: isWaiting ? propagation.waitingReason : null,
    end_reason: endReason,
    continued_in_sync_id: continuedInSyncId,
    created_at: propagation.createdAt,
    updated_at: propagation.updatedAt,
    started_at: propagation.startedAt,
    completed_at: propagation.completedAt
  };
};

export let v1SkillSyncPresenter = Presenter.create(skillSyncType)
  .presenter(async ({ skillSync }) => ({
    object: 'skill.sync' as const,
    id: skillSync.id,
    status: skillSync.status,
    skill_marketplace_id: skillSync.destination.skillMarketplace?.id ?? null,
    skill_plugin_id: skillSync.destination.skillPlugin?.id ?? null,
    logs: [...(skillSync.logs as [number, string][])]
      .sort(([left], [right]) => left - right)
      .map(([ts, msg]) => ({
        timestamp: new Date(ts),
        message: msg
      })),
    repository_propagations: await Promise.all(
      skillSync.repositoryPropagations.map(propagation =>
        presentRepositoryPropagation(propagation, skillSync.destinationOid)
      )
    ),
    created_at: skillSync.createdAt,
    started_at: skillSync.startedAt,
    completed_at: skillSync.completedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.sync'),
      id: v.string(),
      status: v.enumOf([
        'pending',
        'completed',
        'failed',
        'processing',
        'waiting_for_review',
        'canceled'
      ]),
      skill_marketplace_id: v.nullable(v.string()),
      skill_plugin_id: v.nullable(v.string()),
      logs: v.array(v.object({ timestamp: v.date(), message: v.string() })),
      repository_propagations: v.array(skillSyncRepositoryPropagationSchema),
      created_at: v.date(),
      started_at: v.nullable(v.date()),
      completed_at: v.nullable(v.date())
    })
  )
  .build();
