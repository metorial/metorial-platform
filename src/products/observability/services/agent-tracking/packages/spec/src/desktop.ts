import {
  v,
  type ValidationModifier,
  type ValidationResult,
  type ValidationTypeValue
} from '@lowerdeck/validation';
import {
  commitShaPattern,
  count,
  nativeId as sessionId,
  parseTimestamp,
  pattern,
  unsafeTextPattern,
  workspaceKeyPattern
} from './fields';
import { vcsPullRequestKinds } from './record';

export let desktopContextId = 'metorial.desktop.context.v1';

export let desktopContextClients = [
  'claude-code',
  'codex',
  'cursor',
  'antigravity',
  'opencode'
] as const;

export let maxTicketRefs = 8;

let ticketNumber = '[1-9][0-9]{0,6}';

export let ticketKeyPatterns = {
  upper: `[A-Z][A-Z0-9_]{1,9}-${ticketNumber}`,
  mixed: `[A-Za-z][A-Za-z0-9]{1,9}-${ticketNumber}`,
  issue: '#[1-9][0-9]{0,8}'
};

let maxLines = 1_000_000_000;
let maxPullRequestNumber = 2_147_483_647;
let earliestTimestamp = Date.UTC(2015, 0, 1);
let latestTimestamp = Date.UTC(2100, 0, 1);

let providerNames = ['github', 'gitlab', 'bitbucket', 'azure', 'azure_devops', 'codeberg'];

let safeText =
  (maxLength: number): ValidationModifier<string> =>
  value => {
    if (value.length < 1 || value.length > maxLength) {
      return [{ code: 'invalid_length', message: `Expected 1 to ${maxLength} characters` }];
    }
    if (unsafeTextPattern.test(value)) {
      return [{ code: 'invalid_characters', message: 'Control characters are not allowed' }];
    }

    return [];
  };

let validTimestamp: ValidationModifier<string> = value => {
  let time = parseTimestamp(value)?.getTime();

  return time !== undefined && time >= earliestTimestamp && time < latestTimestamp
    ? []
    : [{ code: 'invalid_timestamp', message: 'Expected an RFC 3339 timestamp' }];
};

let timestamp = v.string({ modifiers: [validTimestamp] });
let label = (maxLength: number) => v.string({ modifiers: [safeText(maxLength)] });
let sha = pattern(commitShaPattern);
let lineCount = count(maxLines);
let pullRequestNumber = count(maxPullRequestNumber, 1);
let ticketRef = pattern(
  new RegExp(
    `^(?:${ticketKeyPatterns.upper}|${ticketKeyPatterns.mixed}|${ticketKeyPatterns.issue})$`
  )
);

let desktopSessionContextSchema = v.object({
  kind: v.literal('session_context'),
  session_id: sessionId,
  parent_session_id: v.optional(sessionId),
  remote_url: v.optional(pattern(/^[\x21-\x7e]{1,512}$/)),
  branch: v.optional(label(256)),
  head: v.optional(sha),
  default_branch: v.optional(label(256)),
  worktree: v.optional(v.boolean()),
  sub_path: v.optional(
    v.string({
      modifiers: [
        v.regex(/^(?![A-Za-z]:)(?!\/)(?!.*\/\/)(?!(?:.*\/)?\.\.?(?:\/|$))[^\\]+$/),
        safeText(512)
      ]
    })
  ),
  workspace_key: v.optional(pattern(workspaceKeyPattern)),
  permission_mode: v.optional(pattern(/^[A-Za-z0-9_.-]{1,64}$/)),
  title: v.optional(label(256)),
  entrypoint: v.optional(pattern(/^[A-Za-z0-9_.:\/-]{1,64}$/))
});

let desktopCommitSchema = v.object({
  kind: v.literal('commit'),
  session_id: sessionId,
  sha,
  branch: v.optional(label(256)),
  committed_at: v.optional(timestamp),
  ticket_refs: v.optional(v.array(ticketRef, { modifiers: [v.maxLength(maxTicketRefs)] })),
  ai_authored: v.optional(v.boolean())
});

let desktopPullRequestSchema = v.object({
  kind: v.literal('pull_request'),
  session_id: sessionId,
  relation: v.enumOf(vcsPullRequestKinds),
  provider: pattern(
    new RegExp(
      `^(?:${providerNames.join('|')}|(?=.{4,128}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$`,
      'i'
    )
  ),
  repository: pattern(
    /^(?=.{3,256}$)(?!(?:.*\/)?\.\.?(?:\/|$))[A-Za-z0-9_.~-]{1,128}(?:\/[A-Za-z0-9_.~-]{1,128})+$/
  ),
  number: pullRequestNumber
});

let desktopSessionStatsSchema = v.object({
  kind: v.literal('session_stats'),
  session_id: sessionId,
  lines_added: v.optional(lineCount),
  lines_removed: v.optional(lineCount)
});

export type DesktopSessionContextPayload = ValidationTypeValue<
  typeof desktopSessionContextSchema
>;

export type DesktopCommitPayload = ValidationTypeValue<typeof desktopCommitSchema>;

export type DesktopPullRequestPayload = ValidationTypeValue<typeof desktopPullRequestSchema>;

export type DesktopSessionStatsPayload = ValidationTypeValue<typeof desktopSessionStatsSchema>;

export type DesktopContextPayload =
  | DesktopSessionContextPayload
  | DesktopCommitPayload
  | DesktopPullRequestPayload
  | DesktopSessionStatsPayload;

let schemas = {
  session_context: desktopSessionContextSchema,
  commit: desktopCommitSchema,
  pull_request: desktopPullRequestSchema,
  session_stats: desktopSessionStatsSchema
};

let kindSchema = v.object({
  kind: v.enumOf(Object.keys(schemas) as (keyof typeof schemas)[])
});

export let validateDesktopContextPayload = (
  payload: Record<string, unknown>
): ValidationResult<DesktopContextPayload> => {
  let kind = kindSchema.validate(payload);
  if (!kind.success) return kind;

  let result: ValidationResult<DesktopContextPayload> =
    schemas[kind.value.kind].validate(payload);

  if (
    result.success &&
    result.value.kind == 'session_stats' &&
    result.value.lines_added === undefined &&
    result.value.lines_removed === undefined
  ) {
    return {
      success: false,
      errors: [
        {
          code: 'required',
          message: 'lines_added or lines_removed is required',
          path: ['lines_added']
        }
      ]
    };
  }

  return result;
};
