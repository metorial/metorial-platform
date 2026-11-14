// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillSharePanelContent, type SkillSharePanelMode } from './skillSharePanel';

let state = vi.hoisted(() => ({
  roles: ['creator', 'viewer'],
  hasOrganizationMemberAccess: true,
  grantLevel: undefined as 'read' | 'write' | undefined,
  hasProfile: true,
  hasParticipant: true,
  hasGroup: false,
  groupLevel: null as 'read' | 'write' | 'manage' | null,
  groupIsDefault: false,
  share: vi.fn()
}));

vi.mock('@metorial/state', () => {
  let profile = {
    id: 'profile',
    consumerId: 'consumer',
    name: 'Member',
    email: 'member@example.com'
  };

  let mutator = () => ({ mutate: state.share, isLoading: false, RenderError: () => null });

  let loader = (data: any) => ({ data, isLoading: false, refetch: vi.fn() });

  let group = () => ({ id: 'group', name: 'Team', isDefault: state.groupIsDefault });

  return {
    usePortals: () => loader({ items: [{ id: 'portal', name: 'Portal' }] }),
    useSkillParticipants: () =>
      loader({
        items: state.hasParticipant
          ? [
              {
                id: 'participant',
                roles: state.roles,
                hasOrganizationMemberAccess: state.hasOrganizationMemberAccess,
                actor: {
                  name: profile.name,
                  email: profile.email,
                  consumer: { id: profile.consumerId }
                }
              }
            ]
          : []
      }),
    useUser: () => loader({ id: 'current-user' }),
    usePortalConsumerProfiles: () => loader({ items: state.hasProfile ? [profile] : [] }),
    usePortalConsumerGroups: () => loader({ items: state.hasGroup ? [group()] : [] }),
    usePortalConsumerAccess: () => ({
      ...loader({
        items: state.groupLevel
          ? [
              {
                id: 'group-access',
                consumerGroup: group(),
                accessLevel: state.groupLevel
              }
            ]
          : []
      }),
      deleteMutator: mutator,
      updateMutator: mutator
    }),
    useAllPortalConsumerAccess: () => loader([]),
    useShareSkill: mutator,
    useCreatePortalConsumerAccess: mutator,
    useSkill: () => loader({ storeId: 'store' }),
    useStorePermissions: () => loader({ canManageAccess: true }),
    useSkillAccess: () =>
      loader({
        grants: state.grantLevel
          ? [
              {
                subject: { type: 'consumer_profile', consumerProfileId: profile.id },
                source: { type: 'direct' },
                level: state.grantLevel
              }
            ]
          : []
      })
  };
});

vi.mock('@metorial/ui', async () => {
  let { Select } = await import('../../../../packages/ui/src/select');
  let { theme } = await import('../../../../packages/ui/src/theme');

  return {
    Select,
    theme,
    Avatar: () => null,
    Button: ({ children, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Input: ({ label, onFocus, onInput, value }: any) => (
      <input
        aria-label={label}
        onFocus={onFocus}
        onInput={event => onInput?.(event.currentTarget.value)}
        value={value}
        onChange={() => {}}
      />
    ),
    Menu: ({ children }: any) => <div>{children}</div>,
    Popover: Object.assign(({ children }: any) => <div>{children}</div>, {
      Content: ({ children }: any) => <div>{children}</div>
    }),
    Switch: () => null,
    Text: ({ children }: any) => <span>{children}</span>
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;

let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();

  state.roles = ['creator', 'viewer'];
  state.hasOrganizationMemberAccess = true;
  state.grantLevel = undefined;
  state.hasProfile = true;
  state.hasParticipant = true;

  state.hasGroup = false;
  state.groupLevel = null;
  state.groupIsDefault = false;
  state.share.mockResolvedValue([{}, null]);

  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

let renderPanel = async (mode: SkillSharePanelMode = 'dashboard') => {
  await act(async () =>
    root.render(
      <SkillSharePanelContent
        instanceId="instance"
        context={{ mode, portalId: 'portal', skills: [{ id: 'skill' }] }}
      />
    )
  );

  return host.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Access"]')!;
};

let choose = async (select: HTMLButtonElement, label: string) => {
  await act(async () =>
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  );

  let option = [...document.querySelectorAll('[role="option"]')].find(
    item => item.textContent == label
  )!;
  await act(async () =>
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  );
};

describe('skill participant access', () => {
  it.each(['dashboard', 'portal'] as const)(
    'shows inherited edit-and-share access in a disabled select in %s mode',
    async mode => {
      let select = await renderPanel(mode);

      expect(select.textContent).toBe('Can edit and share');
      expect(select.disabled).toBe(true);
      expect(state.share).not.toHaveBeenCalled();
    }
  );

  it('shows inherited edit-and-share access without a matching portal profile', async () => {
    state.hasProfile = false;
    state.roles = ['editor'];
    let select = await renderPanel();

    expect(select.textContent).toBe('Can edit and share');
    expect(select.disabled).toBe(true);
  });

  it('shows inherited edit-and-share access regardless of historical viewer roles', async () => {
    state.roles = ['viewer'];
    let select = await renderPanel();

    expect(select.textContent).toBe('Can edit and share');
    expect(select.disabled).toBe(true);
  });

  it('keeps inherited access disabled even when a member has a direct portal share', async () => {
    state.grantLevel = 'read';
    let select = await renderPanel();

    expect(select.textContent).toBe('Can edit and share');
    expect(select.disabled).toBe(true);
    expect(state.share).not.toHaveBeenCalled();
  });

  it('keeps owner access visible', async () => {
    state.roles = ['owner'];
    let select = await renderPanel();

    expect(select.textContent).toBe('Owner');
  });

  it('keeps a regular consumer edit share editable', async () => {
    state.hasOrganizationMemberAccess = false;
    state.grantLevel = 'write';
    let select = await renderPanel();

    expect(select.textContent).toBe('Can edit');
    expect(select.disabled).toBe(false);
  });

  it('lets a regular consumer be given edit access', async () => {
    state.hasOrganizationMemberAccess = false;
    state.grantLevel = 'read';
    let select = await renderPanel();
    await choose(select, 'Can edit');

    expect(state.share).toHaveBeenCalledWith({
      instanceId: 'instance',
      skillId: 'skill',
      consumerProfileIds: ['profile'],
      organizationMemberIds: [],
      permission: 'write'
    });
  });
});

describe('skill group access', () => {
  it('resets the group-only sharing permission when an individual is selected', async () => {
    state.hasGroup = true;
    state.hasParticipant = false;
    state.hasOrganizationMemberAccess = false;
    await renderPanel();
    await act(async () => host.querySelector('input')!.focus());

    let group = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.startsWith('Team')
    )!;
    await act(async () => group.click());
    let select = host.querySelector<HTMLButtonElement>(
      '[aria-label="Access for new people"]'
    )!;
    await choose(select, 'Can edit and share');

    let person = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.startsWith('Member')
    )!;
    await act(async () => person.click());
    expect(select.textContent).toBe('Can view');
    await choose(select, 'Can edit');

    let add = [...host.querySelectorAll('button')].find(
      button => button.textContent == 'Add'
    )!;
    await act(async () => add.click());

    expect(state.share).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerProfileIds: ['profile'],
        permission: 'write'
      })
    );
    expect(state.share).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerGroupId: 'group',
        access: { type: 'skill', skillId: 'skill', permission: 'write' }
      })
    );
  });

  it.each(['write', 'manage'] as const)('displays the %s level accurately', async level => {
    state.hasGroup = true;
    state.groupLevel = level;
    await renderPanel();
    let selects = host.querySelectorAll<HTMLButtonElement>(
      '[role="combobox"][aria-label="Access"]'
    );

    expect(selects[1].textContent).toBe(level == 'write' ? 'Can edit' : 'Can edit and share');
  });

  it.each([false, true])(
    'can downgrade sharing to edit-only access (everyone: %s)',
    async isDefault => {
      state.hasGroup = true;
      state.groupIsDefault = isDefault;
      state.groupLevel = 'manage';
      await renderPanel();
      let select = isDefault
        ? host.querySelector<HTMLButtonElement>('[aria-label="Access for everyone"]')!
        : host.querySelectorAll<HTMLButtonElement>(
            '[role="combobox"][aria-label="Access"]'
          )[1];
      await choose(select, 'Can edit');

      expect(state.share).toHaveBeenCalledWith({
        consumerAccessId: 'group-access',
        permission: 'write'
      });
    }
  );

  it.each([
    ['Can edit', 'write'],
    ['Can edit and share', 'manage']
  ])('invites a group with %s access', async (label, permission) => {
    state.hasGroup = true;
    await renderPanel();
    await act(async () => host.querySelector('input')!.focus());

    let candidate = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.startsWith('Team')
    )!;
    await act(async () => candidate.click());
    let select = host.querySelector<HTMLButtonElement>(
      '[aria-label="Access for new people"]'
    )!;
    await choose(select, label);

    let add = [...host.querySelectorAll('button')].find(
      button => button.textContent == 'Add'
    )!;
    await act(async () => add.click());

    expect(state.share).toHaveBeenCalledWith(
      expect.objectContaining({
        consumerGroupId: 'group',
        access: { type: 'skill', skillId: 'skill', permission }
      })
    );
  });
});
