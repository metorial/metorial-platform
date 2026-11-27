import { logTail, reportFailure } from '@metorial/error-reporting/failure';
import type { Slate, SlateDeployment, SlateVersion } from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { functionBay, functionBayTenant } from './functionBay';

let slateCacheLimit = 500;
let slateCache = new Map<bigint, Promise<Slate | null>>();

let getSlate = (slateOid: bigint) => {
  let cached = slateCache.get(slateOid);
  if (cached) return cached;

  if (slateCache.size >= slateCacheLimit) slateCache.clear();
  let slate = db.slate.findUnique({ where: { oid: slateOid } }).catch(() => null);
  slateCache.set(slateOid, slate);
  return slate;
};

let slateDetails = (slate: Slate, version: SlateVersion) => ({
  integration: slate.identifier,
  integration_name: slate.name,
  registry_identifier: slate.slateFullIdentifierOnRegistry,
  version: version.version,
  slate_version_id: version.id
});

let durationMs = (from: Date | null | undefined, to: Date | null | undefined) =>
  from && to ? to.getTime() - from.getTime() : undefined;

let internalLogLines = (deployment: SlateDeployment) =>
  deployment.internalLogs.map(entry => {
    try {
      let parsed = JSON.parse(entry);
      return typeof parsed?.message === 'string' ? parsed.message : entry;
    } catch {
      return entry;
    }
  });

let deploymentBuildLog = async (deployment: SlateDeployment) => {
  let info = deployment.providerDeploymentInfo;
  if (!info) return { lines: [] as string[] };

  let tenantId = (await functionBayTenant).id;
  let [functionDeployment, steps] = await Promise.all([
    functionBay.functionDeployment
      .get({
        tenantId,
        functionId: info.functionId,
        functionDeploymentId: info.functionDeploymentId
      })
      .catch(() => null),
    functionBay.functionDeployment
      .getOutput({
        tenantId,
        functionId: info.functionId,
        functionDeploymentId: info.functionDeploymentId
      })
      .catch(() => [])
  ]);

  let failedStep =
    steps.find(step => step.status === 'failed') ?? steps.findLast(step => step.startedAt);

  return {
    functionDeployment,
    failedStep,
    lines: (failedStep?.logs ?? []).map(line => line.message)
  };
};

export let reportSlateDeploymentFailure = async (d: {
  deployment: SlateDeployment & { slateVersion: SlateVersion };
  errorCode: string;
  errorMessage: string;
}) => {
  let slate = await getSlate(d.deployment.slateOid);
  if (!slate) return;

  let build = await deploymentBuildLog(d.deployment);
  let version = d.deployment.slateVersion;

  reportFailure({
    type: 'IntegrationDeploymentFailed',
    fingerprint: ['integration-deployment-failed', slate.identifier, d.errorCode],
    message: `${slate.name} ${version.version} failed to deploy: ${d.errorMessage} (deployment ${d.deployment.id})`,
    tags: {
      integration: slate.identifier,
      error_code: d.errorCode,
      step: build.failedStep?.name
    },
    details: {
      ...slateDetails(slate, version),
      deployment_id: d.deployment.id,
      function_id: d.deployment.providerDeploymentInfo?.functionId,
      function_deployment_id: d.deployment.providerDeploymentInfo?.functionDeploymentId,
      build_run_id: build.functionDeployment?.forgeRunId ?? undefined,
      runtime_version: d.deployment.providerDeploymentInfo?.runtimeVersion,
      error_code: d.errorCode,
      error_message: d.errorMessage,
      failed_step: build.failedStep?.name,
      failed_step_type: build.failedStep?.type,
      pending_reason: d.deployment.pendingReason,
      duration_ms: durationMs(d.deployment.createdAt, new Date())
    },
    log: logTail(build.lines.length ? build.lines : internalLogLines(d.deployment))
  });
};

export let reportSlateDiscoveryFailure = async (d: {
  version: SlateVersion & { slate: Slate };
  deploymentId?: string;
  invocationId?: string;
  error: { code: string; message: string };
}) => {
  let slate = d.version.slate;

  reportFailure({
    type: 'IntegrationDiscoveryFailed',
    fingerprint: ['integration-discovery-failed', slate.identifier, d.error.code],
    message: `${slate.name} ${d.version.version} failed discovery: ${d.error.message} (version ${d.version.id})`,
    tags: { integration: slate.identifier, error_code: d.error.code, step: 'discovery' },
    details: {
      ...slateDetails(slate, d.version),
      deployment_id: d.deploymentId,
      invocation_id: d.invocationId,
      error_code: d.error.code,
      error_message: d.error.message,
      version_status: d.version.status,
      last_discovered_at: d.version.lastDiscoveredAt?.toISOString()
    }
  });
};

export let reportSlateInvocationFailure = async (d: {
  reason: string;
  slateVersion: SlateVersion;
  invocationId: string;
  providerInvocationId?: string;
  tenantIdentifier?: string;
  methods?: string[];
  error?: unknown;
  logs?: { message: string }[];
}) => {
  let slate = await getSlate(d.slateVersion.slateOid);
  let integration = slate?.identifier ?? d.slateVersion.slateOid.toString();
  let errors = Array.isArray(d.error) ? d.error : [d.error];
  let errorMessage = errors
    .map(error =>
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : error === undefined
          ? undefined
          : String(error)
    )
    .filter(Boolean)
    .join('; ');
  let errorCode = errors
    .map(error =>
      error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
    )
    .find(Boolean);

  reportFailure({
    type: 'IntegrationServerError',
    fingerprint: ['integration-server-error', d.reason, integration],
    message: `${slate?.name ?? integration} ${d.slateVersion.version} failed with a server error (${d.reason}): ${errorMessage || 'no message'} (invocation ${d.invocationId})`,
    error: d.error instanceof Error ? d.error : undefined,
    tags: { integration, error_code: errorCode ?? d.reason },
    details: {
      ...(slate
        ? slateDetails(slate, d.slateVersion)
        : { version: d.slateVersion.version, slate_version_id: d.slateVersion.id }),
      reason: d.reason,
      invocation_id: d.invocationId,
      provider_invocation_id: d.providerInvocationId,
      tenant: d.tenantIdentifier,
      methods: d.methods?.join(', '),
      error_code: errorCode,
      error_message: errorMessage
    },
    log: logTail((d.logs ?? []).map(line => line.message))
  });
};
