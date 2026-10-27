// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  create: vi.fn(),
  tokens: [] as { id: string; secret: string; status: string; server: { id: string } }[],
  list: vi.fn()
}));

vi.mock('@metorial/state', () => ({
  useMagicMcpTokens: (instanceId: string) => {
    mocks.list(instanceId);
    let [error, setError] = useState<{ message: string } | null>(null);
    return {
      data: { items: mocks.tokens },
      isLoading: false,
      error: null,
      createMutator: () => ({
        error,
        mutate: async (input: unknown) => {
          let result = await mocks.create(input);
          setError(result[1]?.data ?? null);
          return result;
        },
        RenderError: () => (error ? <div role="alert">{error.message}</div> : null)
      })
    };
  }
}));

vi.mock('@metorial/data-hooks', () => ({
  renderWithLoader: () => (render: () => React.ReactNode) => render()
}));

vi.mock('@metorial/ui', () => ({
  Callout: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>
}));

vi.mock('@metorial/ui-product', () => ({
  Box: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}));

vi.mock('../../../scenes/mcpConnectionInstructions', () => ({
  McpConnectionInstructionsScene: ({
    tokenValue,
    emptyState
  }: {
    tokenValue: string | null;
    emptyState: React.ReactNode;
  }) => (tokenValue ? <div>{tokenValue}</div> : <>{emptyState}</>)
}));

import { MagicMcpServerConnectionBox } from './connection';

let root: Root;
let container: HTMLDivElement;
let server = { id: 'mgsr_1', name: 'Server', endpoints: [{ url: 'https://example.com/mcp' }] };

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let render = async (canConnect = true, target = server) => {
  await act(async () =>
    root.render(
      <MagicMcpServerConnectionBox
        instanceId="ins_1"
        server={target}
        canConnect={canConnect}
      />
    )
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tokens = [];
  mocks.create.mockResolvedValue([
    null,
    { data: { status: 403, message: 'This server belongs to another owner.' } }
  ]);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe('Magic MCP server connections', () => {
  it('hides the connection box and performs no token work when access is denied or unresolved', async () => {
    await render(false);

    expect(container.textContent).toBe('');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('shows a 403 and never retries automatically across mutation state updates and rerenders', async () => {
    await render();
    for (let attempt = 0; attempt < 5; attempt++) await render();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('This server belongs to another owner.');
    expect(container.textContent).not.toContain('Creating a Magic MCP token');
  });

  it('stops and shows an error if token creation rejects unexpectedly', async () => {
    mocks.create.mockRejectedValue(new Error('Network failure'));
    await render();
    await render();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Could not create a Magic MCP token');
  });

  it('does not create a token when an active server token already exists', async () => {
    mocks.tokens = [
      { id: 'tok_1', secret: 'existing-secret', status: 'active', server: { id: server.id } }
    ];
    await render();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain('existing-secret');
  });

  it('keeps a newly created token while the list refreshes', async () => {
    mocks.create.mockResolvedValue([{ id: 'tok_1', secret: 'created-secret' }, null]);
    await render();
    await render();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('created-secret');
  });

  it('resets the attempt only when navigating to another server', async () => {
    await render();
    await render(true, { ...server, id: 'mgsr_2' });

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ magicMcpServerId: 'mgsr_2' })
    );
  });
});
