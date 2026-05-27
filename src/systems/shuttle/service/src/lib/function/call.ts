import { clientAdapter } from '@metorial/mcp-server';
import type { FunctionInvokeResponse } from '@metorial-platform-systems/function-bay-client';
import type { FunctionServer } from '../../../prisma/generated/client';
import { functionBay } from '../../functionBay';

export type FunctionCallLog = { timestamp: number; message: string };

export let callFunction = async <T>(
  server: FunctionServer,
  handler: (tools: ReturnType<typeof clientAdapter>) => Promise<T>
) => {
  let error: { current: { code: string; message: string } | undefined } = {
    current: undefined
  };
  let functionCallId: { current: string | null } = { current: null };
  let logs: { current: FunctionCallLog[] } = { current: [] };

  try {
    let adapter = clientAdapter(async messages => {
      let res = (await functionBay.function.invoke({
        tenantId: server.functionBayTenantId,
        functionId: server.functionBayFunctionId,
        payload: {
          messages
        }
      })) as FunctionInvokeResponse;

      functionCallId.current = res.id;
      logs.current = res.logs ?? [];

      if (res.type === 'error') {
        error.current = {
          code: res.error.code,
          message: res.error.message
        };
        return [];
      }

      return res.result;
    });

    let res = await handler(adapter);

    if (error.current) {
      return {
        status: 'success' as const,
        error: error.current,
        result: res,
        functionCallId: functionCallId.current,
        logs: logs.current
      };
    }

    return {
      status: 'success' as const,
      result: res,
      functionCallId: functionCallId.current,
      logs: logs.current
    };
  } catch (err) {
    console.warn('Function call error:', err);

    return {
      status: 'error' as const,
      functionCallId: functionCallId.current,
      logs: logs.current,
      error: error.current ?? {
        code: 'internal_error',
        message: 'Unable to process request'
      }
    };
  }
};
