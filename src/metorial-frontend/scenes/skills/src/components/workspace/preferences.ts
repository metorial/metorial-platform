import { useCallback, useSyncExternalStore } from 'react';

export type WorkspacePanelId = 'files' | 'mergeRequests' | 'providers' | 'agents';
export type WorkspacePanelMode = 'auto' | 'on' | 'off';
export type WorkspacePanelPosition = 'left' | 'right' | 'split' | 'dock' | 'sidebar';

export let workspacePanelIds: WorkspacePanelId[] = [
  'files',
  'mergeRequests',
  'providers',
  'agents'
];

export type WorkspacePreferences = {
  position: WorkspacePanelPosition;
  modes: Record<WorkspacePanelId, WorkspacePanelMode>;
  collapsed: Record<string, Partial<Record<WorkspacePanelId, boolean>>>;
  order: WorkspacePanelId[];
  toolbar: boolean;
  assistant: boolean;
};

let storageKey = 'metorial.skill-workspace.preferences.v1';

let defaultPreferences: WorkspacePreferences = {
  position: 'left',
  modes: { files: 'auto', mergeRequests: 'auto', providers: 'auto', agents: 'auto' },
  collapsed: {},
  order: workspacePanelIds,
  toolbar: false,
  assistant: true
};

let positions: WorkspacePanelPosition[] = ['left', 'right', 'split', 'dock', 'sidebar'];
let modes: WorkspacePanelMode[] = ['auto', 'on', 'off'];

export let applyPanelOrder = (stored: WorkspacePanelId[]): WorkspacePanelId[] => {
  let known = stored.filter(
    (id, index) => workspacePanelIds.includes(id) && stored.indexOf(id) == index
  );
  return [...known, ...workspacePanelIds.filter(id => !known.includes(id))];
};

let parse = (raw: string | null): WorkspacePreferences => {
  if (!raw) return defaultPreferences;

  try {
    let value = JSON.parse(raw) as Partial<WorkspacePreferences>;
    let storedModes = (value.modes ?? {}) as Partial<Record<WorkspacePanelId, string>>;

    return {
      position: positions.includes(value.position as WorkspacePanelPosition)
        ? (value.position as WorkspacePanelPosition)
        : defaultPreferences.position,
      modes: Object.fromEntries(
        workspacePanelIds.map(id => [
          id,
          modes.includes(storedModes[id] as WorkspacePanelMode)
            ? storedModes[id]
            : defaultPreferences.modes[id]
        ])
      ) as WorkspacePreferences['modes'],
      collapsed: value.collapsed && typeof value.collapsed == 'object' ? value.collapsed : {},
      order: applyPanelOrder(Array.isArray(value.order) ? value.order : []),
      toolbar: typeof value.toolbar == 'boolean' ? value.toolbar : defaultPreferences.toolbar,
      assistant:
        typeof value.assistant == 'boolean' ? value.assistant : defaultPreferences.assistant
    };
  } catch {
    return defaultPreferences;
  }
};

let current: WorkspacePreferences | null = null;
let listeners = new Set<() => void>();

let read = () => {
  if (current) return current;

  try {
    current = parse(window.localStorage.getItem(storageKey));
  } catch {
    current = defaultPreferences;
  }

  return current;
};

let write = (next: WorkspacePreferences) => {
  current = next;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {}

  listeners.forEach(listener => listener());
};

let subscribe = (listener: () => void) => {
  listeners.add(listener);

  let onStorage = (event: StorageEvent) => {
    if (event.key != storageKey) return;
    current = parse(event.newValue);
    listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export let useWorkspacePreferences = (skillId: string) => {
  let preferences = useSyncExternalStore(subscribe, read, () => defaultPreferences);

  let update = useCallback(
    (fn: (current: WorkspacePreferences) => WorkspacePreferences) => write(fn(read())),
    []
  );

  let setPosition = useCallback(
    (position: WorkspacePanelPosition) => update(p => ({ ...p, position })),
    [update]
  );

  let setMode = useCallback(
    (id: WorkspacePanelId, mode: WorkspacePanelMode) =>
      update(p => ({ ...p, modes: { ...p.modes, [id]: mode } })),
    [update]
  );

  let setCollapsed = useCallback(
    (id: WorkspacePanelId, collapsed: boolean) =>
      update(p => ({
        ...p,
        collapsed: {
          ...p.collapsed,
          [skillId]: { ...p.collapsed[skillId], [id]: collapsed }
        }
      })),
    [update, skillId]
  );

  let setOrder = useCallback(
    (order: WorkspacePanelId[]) => update(p => ({ ...p, order: applyPanelOrder(order) })),
    [update]
  );

  let setToolbar = useCallback(
    (toolbar: boolean) => update(p => ({ ...p, toolbar })),
    [update]
  );

  let setAssistant = useCallback(
    (assistant: boolean) => update(p => ({ ...p, assistant })),
    [update]
  );

  return {
    preferences,
    collapsed: preferences.collapsed[skillId] ?? {},
    setPosition,
    setMode,
    setCollapsed,
    setOrder,
    setToolbar,
    setAssistant
  };
};
