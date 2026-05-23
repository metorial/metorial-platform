import { delay } from '@mtsrc/delay';
import { clientAdapter } from '@metorial/mcp-server';
import type { FunctionServer } from '../../../prisma/generated/client';
import { functionBay } from '../../functionBay';

export let callFunction = async <T>(
  server: FunctionServer,
  handler: (tools: ReturnType<typeof clientAdapter>) => Promise<T>
) => {
  let error: { current: { code: string; message: string } | undefined } = {
    current: undefined
  };
  let functionCallId: { current: string | null } = { current: null };

  try {
    let adapter = clientAdapter(async messages => {
      let res = await functionBay.function.invoke({
        tenantId: server.functionBayTenantId,
        functionId: server.functionBayFunctionId,
        payload: {
          messages
        }
      });

      functionCallId.current = res.id;

      if (res.error) {
        error.current = {
          code: res.error.code,
          message: res.error.message
        };
        return [];
      } else {
        return res.result;
      }
    });

    let res = await handler(adapter);

    if (error.current) {
      return {
        status: 'success' as const,
        error: error.current,
        result: res,
        functionCallId: functionCallId.current
      };
    }

    return {
      status: 'success' as const,
      result: res,
      functionCallId: functionCallId.current
    };
  } catch (err) {
    console.warn('Function call error:', err);

    return {
      status: 'error' as const,
      functionCallId: functionCallId.current,
      error: error.current ?? {
        code: 'internal_error',
        message: 'Unable to process request'
      }
    };
  }
};

export let getFunctionCallLogs = async (d: {
  server: FunctionServer;
  functionCallId: string;
  waitForLogs?: boolean;
  attempts?: number;
  delayMs?: number;
}) => {
  let attempts = d.waitForLogs ? (d.attempts ?? 10) : 1;

  for (let i = 0; i < attempts; i++) {
    try {
      let out = await functionBay.functionInvocation.get({
        tenantId: d.server.functionBayTenantId,
        functionId: d.server.functionBayFunctionId,
        functionInvocationId: d.functionCallId
      });

      if (!d.waitForLogs || out.logs.length > 0) return out.logs;
    } catch (err) {
      if (!d.waitForLogs) return [];
    }

    if (i < attempts - 1) {
      await delay(d.delayMs ?? 1000); // Wait for logs to be available
    }
  }

  return [];
};
