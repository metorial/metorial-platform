import type { JSONRPCErrorResponse } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export let mcpValidate = <S extends z.ZodSchema>(
  id: string | number | null | undefined,
  schema: S,
  data: any
) => {
  let res = schema.safeParse(data);
  if (!res.success) {
    return {
      success: false as const,
      error: {
        jsonrpc: '2.0',
        id: id ?? undefined,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: z.treeifyError(res.error)
        }
      } satisfies JSONRPCErrorResponse
    };
  }

  if (typeof res.data !== 'object' || res.data === null) {
    throw new Error('mcpValidate: Parsed data is not an object');
  }

  return {
    success: true as const,
    data: {
      method: (res.data as any).method,
      ...res.data,
      jsonrpc: '2.0' as const,
      id: (id ?? data.id ?? null) as string | number | null
    }
  };
};
