/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let mocks = vi.hoisted(() => ({
  status: 'retrying',
  refetch: vi.fn()
}));

vi.mock('@metorial/data-hooks', () => ({
  createLoader: () => ({
    use: () => ({
      data: { status: mocks.status },
      refetch: mocks.refetch
    })
  })
}));

vi.mock('../../user', () => ({
  withAuth: vi.fn()
}));

import { useCallbackNotification } from './callbackNotifications';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

let NotificationLoaderHarness = (p: { pollInterval?: number | null }) => {
  useCallbackNotification('ins_test', 'cbk_test', 'sdi_test', {
    pollInterval: p.pollInterval
  });
  return null;
};

let render = async (pollInterval?: number | null) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(<NotificationLoaderHarness pollInterval={pollInterval} />);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.status = 'retrying';
  mocks.refetch.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  vi.useRealTimers();
});

describe('useCallbackNotification polling', () => {
  it('refreshes active notification details on the configured interval', async () => {
    await render(1000);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(3);
  });

  it('stops refreshing after the notification reaches a terminal status', async () => {
    await render(1000);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(1);

    mocks.status = 'failed';
    await act(async () => {
      root!.render(<NotificationLoaderHarness pollInterval={1000} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('allows polling to be disabled explicitly', async () => {
    await render(null);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mocks.refetch).not.toHaveBeenCalled();
  });
});
