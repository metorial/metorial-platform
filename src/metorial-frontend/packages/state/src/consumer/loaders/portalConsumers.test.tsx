// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useAllPortalConsumerAccess, useDeletePortalConsumerAccess } from './portalConsumers';

let { list, revoke } = vi.hoisted(() => ({ list: vi.fn(), revoke: vi.fn() }));

vi.mock('../../user', () => ({
  withAuth: (fn: (sdk: unknown) => unknown) =>
    fn({ portals: { consumerAccess: { list, delete: revoke } } })
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it.each([
  {
    query: { type: 'magic_mcp_server' as const, magicMcpServerId: 'server' },
    closeBeforeRevoke: true
  },
  {
    query: { type: 'provider_template' as const, providerTemplateId: ['template'] },
    closeBeforeRevoke: true
  },
  {
    query: { type: 'magic_mcp_server' as const, magicMcpServerId: 'server' },
    closeBeforeRevoke: false
  }
])(
  'refreshes $query.type grants after revocation (closed: $closeBeforeRevoke)',
  async ({ query, closeBeforeRevoke }) => {
    let instanceId = 'instance';
    let portalId = `${query.type}:${closeBeforeRevoke}`;
    let grant = { id: 'revoked-grant' };
    let items = [grant];
    list.mockClear().mockImplementation(async () => ({
      items,
      pagination: { hasMoreAfter: false, hasMoreBefore: false }
    }));
    revoke.mockImplementation(async () => {
      items = [];
      return grant;
    });

    let removeAccess: () => Promise<unknown>;
    let AccessList = () => {
      let access = useAllPortalConsumerAccess(instanceId, portalId, query);
      return <div>{access.data?.map(grant => grant.id).join(',')}</div>;
    };
    let Page = ({ showAccessList }: { showAccessList: boolean }) => {
      let removal = useDeletePortalConsumerAccess();
      removeAccess = () =>
        removal.mutate({ instanceId, portalId, consumerAccessId: grant.id });
      return showAccessList ? <AccessList /> : null;
    };

    let container = document.createElement('div');
    let root = createRoot(container);
    let render = (showAccessList: boolean) =>
      act(async () => root.render(<Page showAccessList={showAccessList} />));

    try {
      await render(true);
      expect(container.textContent).toBe(grant.id);

      if (closeBeforeRevoke) await render(false);

      await act(async () => {
        await removeAccess();
      });

      if (closeBeforeRevoke) {
        expect(list).toHaveBeenCalledTimes(1);
        await render(true);
      }

      expect(container.textContent).toBe('');
      expect(list).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => root.unmount());
    }
  }
);
