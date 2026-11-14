// @vitest-environment jsdom

import { applyPatch } from '@lowerdeck/patch';
import React, { act, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let server = {
  value: { instances: {} } as any,
  listeners: new Set<() => void>(),
  set(value: any) {
    server.value = value;
    server.snapshot = { value };
    for (let listener of server.listeners) listener();
  },
  snapshot: { value: { instances: {} } } as any
};

let patchMutate = vi.fn();

vi.mock('../organization/current', () => ({
  useCurrentOrganization: () => ({
    data: { id: 'org_1', currentInstance: { id: 'ins_1' }, currentProject: { id: 'proj_1' } }
  })
}));

vi.mock('../organization/loaders/organizationConfig', () => ({
  useOrganizationConfig: () => {
    let snapshot = useSyncExternalStore(
      listener => {
        server.listeners.add(listener);
        return () => server.listeners.delete(listener);
      },
      () => server.snapshot
    );

    return {
      data: snapshot,
      isLoading: false,
      error: null,
      usePatchMutator: () => ({ mutate: patchMutate })
    };
  }
}));

import { createBaseConfigHook } from './createBaseConfigHook';
import { createFieldConfigHook } from './createFieldConfigHook';
import { createInstanceScopedConfigHook } from './createScopedConfigHooks';
import { createSetConfigHook } from './createSetConfigHook';

let usePinned = createSetConfigHook(
  createInstanceScopedConfigHook(createBaseConfigHook('skills.pinned'), 'instances')
);

let gates: (() => void)[] = [];
let failNext = false;

let render = async <T,>(useHook: () => T) => {
  let current: { value: T } = { value: undefined as T };
  let Component = () => {
    current.value = useHook();
    return null;
  };

  let root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Component />));

  return { current, unmount: () => act(async () => root.unmount()) };
};

let release = async () => {
  await act(async () => {
    gates.shift()!();
  });
};

beforeEach(() => {
  gates = [];
  failNext = false;
  server.set({ instances: {} });
  patchMutate.mockReset();

  patchMutate.mockImplementation(async (body: { operations: any[] }) => {
    await new Promise<void>(resolve => gates.push(resolve));

    if (failNext) {
      failNext = false;
      return [null, new Error('failed')];
    }

    server.set(applyPatch(server.value, body.operations));

    return [{ value: server.value }, null];
  });
});

it('shows a write immediately and keeps it once the server confirms', async () => {
  let hook = await render(usePinned);

  let pending: Promise<boolean>;
  await act(async () => {
    pending = hook.current.value.add('skill_1');
  });

  expect(hook.current.value.has('skill_1')).toBe(true);
  expect(server.value.instances).toEqual({});

  await release();
  expect(await pending!).toBe(true);

  expect(server.value.instances).toEqual({ ins_1: ['skill_1'] });
  expect(hook.current.value.items).toEqual(['skill_1']);

  await hook.unmount();
});

it('sends operations scoped to the current instance', async () => {
  let hook = await render(usePinned);

  await act(async () => {
    void hook.current.value.add('skill_1');
  });

  expect(patchMutate).toHaveBeenCalledWith({
    operations: [{ op: 'add', path: ['instances', 'ins_1'], value: 'skill_1' }]
  });

  await release();
  await hook.unmount();
});

it('keeps rapid writes and sends them one after another', async () => {
  let hook = await render(usePinned);

  await act(async () => {
    void hook.current.value.add('skill_1');
    void hook.current.value.add('skill_2');
  });

  expect(hook.current.value.items).toEqual(['skill_1', 'skill_2']);
  expect(patchMutate).toHaveBeenCalledTimes(1);

  await release();
  expect(patchMutate).toHaveBeenCalledTimes(2);
  expect(hook.current.value.items).toEqual(['skill_1', 'skill_2']);

  await release();
  expect(server.value.instances).toEqual({ ins_1: ['skill_1', 'skill_2'] });

  await hook.unmount();
});

it('reverts a failed write and keeps the others', async () => {
  let hook = await render(usePinned);

  await act(async () => {
    void hook.current.value.add('skill_1');
  });
  await release();

  failNext = true;
  let failed: Promise<boolean>;
  await act(async () => {
    failed = hook.current.value.add('skill_2');
  });
  expect(hook.current.value.items).toEqual(['skill_1', 'skill_2']);

  await release();
  expect(await failed!).toBe(false);
  expect(hook.current.value.items).toEqual(['skill_1']);

  await hook.unmount();
});

it('rebases pending writes onto a value that changed on the server', async () => {
  let hook = await render(usePinned);

  await act(async () => {
    void hook.current.value.add('mine');
  });

  await act(async () => {
    server.set({ instances: { ins_1: ['from_other_tab'] } });
  });

  expect(hook.current.value.items).toEqual(['from_other_tab', 'mine']);

  await release();
  expect(server.value.instances.ins_1).toEqual(['from_other_tab', 'mine']);

  await hook.unmount();
});

it('toggles based on the optimistic value', async () => {
  let hook = await render(usePinned);

  await act(async () => {
    void hook.current.value.toggle('skill_1');
  });
  expect(hook.current.value.has('skill_1')).toBe(true);

  await act(async () => {
    void hook.current.value.toggle('skill_1');
  });
  expect(hook.current.value.has('skill_1')).toBe(false);

  await release();
  await release();
  expect(server.value.instances).toEqual({ ins_1: [] });

  await hook.unmount();
});

it('does nothing when disabled', async () => {
  let hook = await render(() => usePinned({ enabled: false }));

  let saved = await hook.current.value.add('skill_1');

  expect(saved).toBe(false);
  expect(patchMutate).not.toHaveBeenCalled();
  expect(hook.current.value.items).toEqual([]);

  await hook.unmount();
});

it('supports an explicit instance id', async () => {
  let hook = await render(() => usePinned({ instanceId: 'ins_2' }));

  await act(async () => {
    void hook.current.value.add('skill_9');
  });

  expect(patchMutate).toHaveBeenCalledWith({
    operations: [{ op: 'add', path: ['instances', 'ins_2'], value: 'skill_9' }]
  });

  await release();
  await hook.unmount();
});

it('derives a field hook from the same base', async () => {
  let useInstances = createFieldConfigHook(createBaseConfigHook('skills.pinned'), 'instances');
  let hook = await render(useInstances);

  expect(hook.current.value.value).toEqual({});

  await hook.unmount();
});
