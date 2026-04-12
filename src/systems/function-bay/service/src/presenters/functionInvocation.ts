import type { FunctionInvocation, FunctionVersion } from '../../prisma/generated/client';

export let functionInvocationPresenter = (
  invocation: FunctionInvocation & { functionVersion: FunctionVersion }
) => ({
  object: 'function_bay#function.invocation',

  id: invocation.id,
  status: invocation.status,

  functionVersionId: invocation.functionVersion.id,

  billedTimeMs: invocation.billedTimeMs,
  computeTimeMs: invocation.computeTimeMs,

  error: invocation.error,

  logs: !invocation.logs
    ? []
    : invocation.logs.split('\n').map(line => {
        let [ts, message] = JSON.parse(line);

        return {
          timestamp: ts,
          message
        };
      }),

  createdAt: invocation.createdAt
});
