import { v, type ValidationTypeValue } from '@lowerdeck/validation';

/**
 * The code-bucket exporter reports structured failures as a gRPC status whose message is
 * this prefix followed by JSON (Go `pkg/export`). nice-grpc exposes that message as
 * `ClientError.details`; `error.message` carries it after the `/rpc.Service/Method CODE:`
 * prefix.
 */
export let EXPORT_ERROR_PREFIX = 'origin_export_error:';

export let exportErrorCodes = [
  'manifest_invalid',
  'source_not_found',
  'content_mismatch',
  'deletion_guard_tripped',
  'tree_too_large',
  'rate_limited',
  'file_too_large',
  'lfs_quota_exceeded',
  'branch_missing',
  'destination_too_large',
  'path_conflict',
  'unimplemented'
] as const;

export type ExportErrorCode = (typeof exportErrorCodes)[number];

let optionalNumber = v.optional(v.number());
let optionalString = v.optional(v.string());

let exportErrorValidator = v.object({
  code: v.enumOf([...exportErrorCodes]),
  message: v.string(),
  details: v.optional(
    v.object({
      paths: v.optional(v.array(v.string())),
      keys: v.optional(v.array(v.string())),
      total: optionalNumber,
      path: optionalString,
      key: optionalString,
      line: optionalNumber,
      reason: optionalString,
      size: optionalNumber,
      limit: optionalNumber,
      unexpectedDeletes: optionalNumber,
      scopeEntries: optionalNumber,
      maxUnexpectedDeletes: optionalNumber,
      maxUnexpectedDeleteRatio: optionalNumber
    })
  ),
  commitsCreated: optionalNumber,
  writeRequests: optionalNumber,
  startHeadSha: optionalString,
  lastCommitSha: optionalString,
  foreignCommits: v.optional(v.boolean()),
  retryAfterUnix: optionalNumber,
  stats: v.optional(v.record(v.number())),
  newRemoteState: v.optional(
    v.object({
      commitSha: v.string(),
      treeSha: v.string(),
      listingBucket: v.string(),
      listingKey: v.string(),
      entryCount: v.number()
    })
  )
});

type ExportErrorPayload = ValidationTypeValue<typeof exportErrorValidator>;

// startHeadSha is the branch head an export run started from; lastCommitSha is the last commit
// that run created itself. foreignCommits means the head moved to someone else's commit mid-run.
export type ExportLineage = {
  startHeadSha: string | null;
  lastCommitSha: string | null;
  foreignCommits: boolean;
};

export let toExportLineage = (d: {
  startHeadSha?: string | null;
  lastCommitSha?: string | null;
  foreignCommits?: boolean | null;
}): ExportLineage => ({
  startHeadSha: d.startHeadSha || null,
  lastCommitSha: d.lastCommitSha || null,
  foreignCommits: !!d.foreignCommits
});

export type ExportError = {
  code: ExportErrorCode;
  message: string;
  details: NonNullable<ExportErrorPayload['details']>;
  commitsCreated: number;
  writeRequests: number | null;
  lineage: ExportLineage;
  retryAfter: Date | null;
  stats: Record<string, number>;
  newRemoteState: ExportErrorPayload['newRemoteState'] | null;
};

let parsePayload = (raw: string): ExportErrorPayload | undefined => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }

  let result = exportErrorValidator.validate(json);
  return result.success ? result.value : undefined;
};

let getStatusMessage = (error: any): string | undefined => {
  if (typeof error?.details === 'string' && error.details.startsWith(EXPORT_ERROR_PREFIX)) {
    return error.details;
  }

  let message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  let at = message.indexOf(EXPORT_ERROR_PREFIX);
  return at >= 0 ? message.slice(at) : undefined;
};

export let parseExportError = (error: unknown): ExportError | undefined => {
  let message = getStatusMessage(error);
  if (!message) return undefined;

  let payload = parsePayload(message.slice(EXPORT_ERROR_PREFIX.length));
  if (!payload) return undefined;

  return {
    code: payload.code,
    message: payload.message,
    details: payload.details ?? {},
    commitsCreated: payload.commitsCreated ?? 0,
    writeRequests: payload.writeRequests ?? null,
    lineage: toExportLineage(payload),
    retryAfter: payload.retryAfterUnix ? new Date(payload.retryAfterUnix * 1000) : null,
    stats: payload.stats ?? {},
    newRemoteState: payload.newRemoteState ?? null
  };
};
