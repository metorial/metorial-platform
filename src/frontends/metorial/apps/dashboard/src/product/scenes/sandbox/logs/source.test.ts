import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/state', () => ({
  fetchSandboxMachineInstanceLogs: vi.fn(),
  isSandboxLogsUnavailableError: (error: unknown) => error === 'no_stream'
}));

import { fetchSandboxMachineInstanceLogs } from '@metorial/state';
import { createSandboxMachineLogSource } from './source';

let fetchLogs = vi.mocked(fetchSandboxMachineInstanceLogs);

beforeEach(() => vi.clearAllMocks());

describe('machine log source', () => {
  it('forwards absolute cursors and maps stream metadata for backward and forward pages', async () => {
    fetchLogs.mockResolvedValue({
      object: 'sandbox.log_lines',
      lines: [
        {
          index: 9,
          source: 'stderr',
          text: 'failed',
          timestamp: new Date('2026-10-14T12:00:00Z')
        }
      ],
      nextCursor: 9,
      hasMore: true,
      lineCount: 15,
      status: 'open',
      truncated: true
    });
    let source = createSandboxMachineLogSource({
      instanceId: 'instance',
      machineId: 'machine',
      machineInstanceId: 'boot'
    });
    let signal = new AbortController().signal;
    let page = await source.fetch({ direction: 'backward', cursor: 10, limit: 200, signal });

    expect(fetchLogs).toHaveBeenCalledWith({
      instanceId: 'instance',
      machineId: 'machine',
      machineInstanceId: 'boot',
      direction: 'backward',
      cursor: 10,
      limit: 200,
      signal
    });
    expect(page).toMatchObject({
      lines: [{ index: 9, stream: 'stderr', text: 'failed' }],
      hasMore: true,
      status: 'open',
      truncated: true,
      lineCount: 15
    });

    await source.fetch({ direction: 'forward', cursor: 15, limit: 100 });
    expect(fetchLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: 'forward', cursor: 15 })
    );
  });

  it('keeps waiting for a live stream and seals a missing finished stream', async () => {
    fetchLogs.mockRejectedValue('no_stream');
    let live = true;
    let source = createSandboxMachineLogSource({
      instanceId: 'i',
      machineId: 'm',
      machineInstanceId: 'b',
      isLive: () => live
    });
    expect(await source.fetch({ direction: 'backward', limit: 100 })).toMatchObject({
      lines: [],
      status: 'open'
    });
    live = false;
    expect(await source.fetch({ direction: 'forward', limit: 100 })).toMatchObject({
      lines: [],
      status: 'sealed'
    });
  });

  it('surfaces permission and other errors rather than treating them as empty output', async () => {
    fetchLogs.mockRejectedValue(new Error('permission denied'));
    let source = createSandboxMachineLogSource({
      instanceId: 'i',
      machineId: 'm',
      machineInstanceId: 'b'
    });
    await expect(source.fetch({ direction: 'backward', limit: 100 })).rejects.toThrow(
      'permission denied'
    );
  });
});
