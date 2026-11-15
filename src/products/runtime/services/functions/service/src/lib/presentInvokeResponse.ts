export type FunctionInvocationResult = (
  | {
      type: 'success';
      result: any;
    }
  | {
      type: 'error';
      error: {
        code: any;
        message: any;
      };
      internalError?: string;
    }
) & {
  logs: [number, string][];
  computeTimeMs: number;
  billedTimeMs: number;
};

export let formatInvocationLogs = (logs: [number, string][]) =>
  logs.map(([timestamp, message]) => ({ timestamp, message }));

export let presentInvokeResponse = (d: {
  id: string;
  functionVersionId: string;
  res: FunctionInvocationResult;
}) => {
  let logs = formatInvocationLogs(d.res.logs);
  let base = {
    id: d.id,
    logs,
    computeTimeMs: d.res.computeTimeMs,
    billedTimeMs: d.res.billedTimeMs,
    functionVersionId: d.functionVersionId
  };

  if (d.res.type === 'error') {
    return {
      ...base,
      type: 'error' as const,
      status: 'failed' as const,
      error: d.res.error,
      result: undefined
    };
  }

  return {
    ...base,
    type: 'success' as const,
    status: 'succeeded' as const,
    error: null,
    result: d.res.result
  };
};

export type FunctionInvokeResponse = ReturnType<typeof presentInvokeResponse>;
