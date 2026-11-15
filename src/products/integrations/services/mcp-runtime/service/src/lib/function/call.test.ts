import { describe, expect, it, vi } from 'vitest';
import { callFunction } from './call';
import { functionBay } from '../../functionBay';

vi.mock('@metorial/mcp-server', () => ({
  clientAdapter: (transport: (messages: any[]) => Promise<any[]>) => ({
    discover: async () => {
      let [res] = await transport([{ type: 'metorial-mcp.discover' }]);
      return res;
    }
  })
}));

vi.mock('../../functionBay', () => ({
  functionBay: {
    function: {
      invoke: vi.fn()
    }
  }
}));

describe('callFunction', () => {
  it('returns an error when Function Bay invoke returns an error response', async () => {
    vi.mocked(functionBay.function.invoke).mockResolvedValueOnce({
      id: 'invocation_123',
      type: 'error',
      status: 'failed',
      logs: [{ timestamp: 1_700_000_000_000, message: 'boom' }],
      computeTimeMs: 10,
      billedTimeMs: 10,
      functionVersionId: 'function_version_123',
      error: {
        code: 'function_error',
        message: 'Function failed during discovery'
      },
      result: undefined
    } as any);

    let res = await callFunction(
      {
        functionBayTenantId: 'tenant_123',
        functionBayFunctionId: 'function_123'
      } as any,
      {},
      client => client.discover()
    );

    expect(res).toEqual({
      status: 'error',
      functionCallId: 'invocation_123',
      logs: [{ timestamp: 1_700_000_000_000, message: 'boom' }],
      error: {
        code: 'function_error',
        message: 'Function failed during discovery'
      }
    });
  });
});
