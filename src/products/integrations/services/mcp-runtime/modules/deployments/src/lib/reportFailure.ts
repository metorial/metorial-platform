import { db } from '@mtsrc/mcp-runtime-db';
import { functionBay } from '@mtsrc/mcp-runtime-function-bay';
import { logTail, reportFailure } from '@metorial/error-reporting/failure';

export type ServerDeploymentSystemFailure = { code: string; message: string };

// Function Bay prefixes build service codes; a failing build is the server's own code.
let customerBuildFailureCodes = new Set(['function_bay.build_failed']);

export let isSystemFunctionBayFailure = (code: string | null | undefined) =>
  !code || !customerBuildFailureCodes.has(code);

let stepLogLines = (logs: unknown[]) =>
  logs.flatMap(entry => {
    if (Array.isArray(entry)) return typeof entry[1] === 'string' ? [entry[1]] : [];
    if (entry && typeof entry === 'object' && 'logs' in entry && Array.isArray(entry.logs))
      return entry.logs.filter((line): line is string => typeof line === 'string');
    return typeof entry === 'string' ? [entry] : [];
  });

let functionBayBuildLog = async (functionServer: {
  functionBayTenantId: string;
  functionBayFunctionId: string;
  functionBayDeploymentId: string;
}) => {
  let steps = await functionBay.functionDeployment
    .getOutput({
      tenantId: functionServer.functionBayTenantId,
      functionId: functionServer.functionBayFunctionId,
      functionDeploymentId: functionServer.functionBayDeploymentId
    })
    .catch(() => []);
  let failedStep = steps.find(step => step.status === 'failed');
  return failedStep
    ? { step: failedStep.name, lines: failedStep.logs.map(line => line.message) }
    : null;
};

export let reportServerDeploymentFailure = async (d: {
  serverDeploymentId: string;
  failure: ServerDeploymentSystemFailure;
  level?: 'error' | 'warning';
}) => {
  try {
    let deployment = await db.serverDeployment.findFirst({
      where: { id: d.serverDeploymentId },
      include: {
        server: true,
        tenant: true,
        functionServer: true,
        steps: { orderBy: { createdAt: 'asc' } }
      }
    });
    if (!deployment || deployment.tenant?.collectErrors === false) return;

    let failedStep =
      deployment.steps.findLast(step => step.status === 'failed') ?? deployment.steps.at(-1);
    let functionServer = deployment.functionServer;
    let buildLog =
      functionServer && d.failure.code.startsWith('function_bay.')
        ? await functionBayBuildLog(functionServer)
        : null;

    reportFailure({
      type: 'ServerDeploymentFailed',
      level: d.level,
      fingerprint: ['server-deployment-failed', deployment.server.type, d.failure.code],
      message: `MCP server deployment failed: ${d.failure.message} (deployment ${deployment.id})`,
      tags: {
        error_code: d.failure.code,
        provider: deployment.server.type,
        step: buildLog?.step ?? failedStep?.type
      },
      details: {
        server_deployment_id: deployment.id,
        server_id: deployment.server.id,
        server_name: deployment.server.name,
        server_type: deployment.server.type,
        tenant: deployment.tenant?.identifier,
        status: deployment.status,
        failure_code: d.failure.code,
        failure_message: d.failure.message,
        failed_step: failedStep?.type,
        steps: deployment.steps.map(step => `${step.type}:${step.status}`).join(', '),
        function_server_id: functionServer?.id,
        function_server_error_code: functionServer?.errorCode,
        function_server_error_message: functionServer?.errorMessage,
        function_bay_function_id: functionServer?.functionBayFunctionId,
        function_bay_deployment_id: functionServer?.functionBayDeploymentId,
        duration_ms: Date.now() - (deployment.startedAt ?? deployment.createdAt).getTime()
      },
      log: logTail(buildLog?.lines ?? stepLogLines(failedStep?.logs ?? []))
    });
  } catch (error) {
    console.error('Could not report MCP server deployment failure', error);
  }
};
