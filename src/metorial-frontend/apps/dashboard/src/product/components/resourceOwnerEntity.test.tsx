// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  portalId: undefined as string | undefined,
  portals: vi.fn()
}));
vi.mock('@metorial/state', () => ({
  useCurrentInstance: () => ({ data: { id: 'ins_1' } }),
  useCurrentOrganization: () => ({ data: {} }),
  useCurrentProject: () => ({ data: {} }),
  usePortals: mocks.portals
}));
vi.mock('@metorial/frontend-config', () => ({
  Paths: {
    instance: {
      portal: (_org: unknown, _project: unknown, _instance: unknown, ...parts: string[]) =>
        `/portal/${parts.join('/')}`
    }
  }
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ portalId: mocks.portalId }),
  Link: ({ to, children, ...props }: any) => (
    <a {...props} href={to}>
      {children}
    </a>
  )
}));
vi.mock('@metorial/ui', () => ({
  theme: { colors: { gray600: '#666', gray900: '#111' } },
  Avatar: () => <span>Avatar</span>,
  Badge: () => null,
  Text: () => null,
  Button: ({ children }: any) => <span>{children}</span>,
  Entity: {
    Wrapper: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
    Field: ({ children, title }: any) => (
      <div>
        {title}
        {children}
      </div>
    )
  }
}));

import { ResourceOwnerEntity, ResourceOwnerInline } from './resourceOwnerEntity';
import type { OwnedResource } from '../lib/resourceOwnership';

let root: Root;
let container: HTMLDivElement;
let resource: OwnedResource;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.portalId = undefined;
  mocks.portals.mockReturnValue({ data: { items: [{ id: 'ptl_default' }] } });
  resource = {
    access: {
      source: null,
      type: 'owner_locked',
      visibility: 'owner',
      owner: {
        type: 'organization_member',
        name: 'Member',
        email: 'member@example.com',
        imageUrl: null,
        organizationMember: { id: 'mem_1' },
        consumer: { id: 'inc_1', profileId: 'cop_member', portalId: null }
      }
    }
  };
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe('resource owner profile links', () => {
  it('links organization member owners to their consumer profile', () => {
    act(() => root.render(<ResourceOwnerEntity resource={resource} />));
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/portal/ptl_default/account/cop_member'
    );
    expect(container.textContent).toContain('View Account');
    expect(container.textContent).not.toContain('View Member');
  });

  it('uses the current portal context for organization member profiles', () => {
    mocks.portalId = 'ptl_current';
    act(() => root.render(<ResourceOwnerInline resource={resource} />));
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/portal/ptl_current/account/cop_member'
    );
    expect(mocks.portals).toHaveBeenCalledWith(null, { limit: 1, order: 'asc' });
  });

  it('uses the owning portal for portal consumer profiles', () => {
    mocks.portalId = 'ptl_current';
    resource.access!.owner!.consumer!.portalId = 'ptl_owner';
    act(() => root.render(<ResourceOwnerEntity resource={resource} />));
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/portal/ptl_owner/account/cop_member'
    );
  });
});
