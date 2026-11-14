export type SandboxFailure = { code: string; message: string };

export let sandboxFailureCodes = [
  'provision_failed',
  'start_failed',
  'disk_unavailable',
  'image_unavailable',
  'resize_failed',
  'timeout',
  'cancelled',
  'internal_error'
] as const;

export type SandboxFailureCode = (typeof sandboxFailureCodes)[number];

export let sandboxBuildFailureCodes = [
  'build_failed',
  'context_unavailable',
  'upload_failed',
  'replication_failed',
  'timeout',
  'cancelled',
  'internal_error'
] as const;

export type SandboxBuildFailureCode = (typeof sandboxBuildFailureCodes)[number];

let failureMessages: Record<SandboxFailureCode, string> = {
  provision_failed: 'The sandbox could not be provisioned.',
  start_failed: 'The sandbox failed to start.',
  disk_unavailable: 'A disk required by the sandbox is unavailable.',
  image_unavailable: 'The sandbox image is unavailable.',
  resize_failed: 'The disk could not be resized.',
  timeout: 'The operation timed out.',
  cancelled: 'The operation was cancelled.',
  internal_error: 'An internal error occurred.'
};

let buildFailureMessages: Record<SandboxBuildFailureCode, string> = {
  build_failed: 'The image build failed. Check the build logs for details.',
  context_unavailable: 'The build context could not be read.',
  upload_failed: 'The build context could not be uploaded.',
  replication_failed: 'The image could not be replicated to every region.',
  timeout: 'The image build timed out.',
  cancelled: 'The image build was cancelled.',
  internal_error: 'An internal error occurred.'
};

let failureRules: { pattern: RegExp; code: SandboxFailureCode }[] = [
  { pattern: /cancel/, code: 'cancelled' },
  { pattern: /timeout|timed_out|deadline|stalled|expired/, code: 'timeout' },
  { pattern: /resize/, code: 'resize_failed' },
  { pattern: /^image|machine_images/, code: 'image_unavailable' },
  { pattern: /^disks?_|mount|rootfs/, code: 'disk_unavailable' },
  { pattern: /start|resume|agent|entrypoint|runtime|hook|interrupted/, code: 'start_failed' },
  { pattern: /platform|provision|capacity|builder_lost|unavailable/, code: 'provision_failed' }
];

export let mapSandboxFailureCode = (code: string): SandboxFailureCode =>
  failureRules.find(rule => rule.pattern.test(code))?.code ?? 'internal_error';

export let mapSandboxFailure = (
  failure: SandboxFailure | null | undefined
): SandboxFailure | null => {
  if (!failure) return null;

  let code = mapSandboxFailureCode(failure.code);

  return { code, message: failureMessages[code] };
};

export let mapSandboxBuildFailure = (
  failure: SandboxFailure | null | undefined
): SandboxFailure | null => {
  if (!failure) return null;

  let code: SandboxBuildFailureCode = (sandboxBuildFailureCodes as readonly string[]).includes(
    failure.code
  )
    ? (failure.code as SandboxBuildFailureCode)
    : /cancel/.test(failure.code)
      ? 'cancelled'
      : /timeout|timed_out/.test(failure.code)
        ? 'timeout'
        : /build|dockerfile|context/.test(failure.code)
          ? 'build_failed'
          : 'internal_error';

  return { code, message: buildFailureMessages[code] };
};
