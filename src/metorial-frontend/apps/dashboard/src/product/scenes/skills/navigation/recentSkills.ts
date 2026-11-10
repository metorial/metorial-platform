import { useCallback, useSyncExternalStore } from 'react';

let storageKey = 'metorial.skills.recent.v1';
let maxRecentSkills = 25;

type RecentSkills = Record<string, string[]>;

let emptyRecentSkills: RecentSkills = {};

let parse = (raw: string | null): RecentSkills => {
  if (!raw) return emptyRecentSkills;

  try {
    let value = JSON.parse(raw);
    return value && typeof value == 'object' ? value : emptyRecentSkills;
  } catch {
    return emptyRecentSkills;
  }
};

let current: RecentSkills | null = null;
let listeners = new Set<() => void>();

let read = () => {
  if (current) return current;

  try {
    current = parse(window.localStorage.getItem(storageKey));
  } catch {
    current = emptyRecentSkills;
  }

  return current;
};

let write = (next: RecentSkills) => {
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

export let recordRecentSkill = (instanceId: string, skillId: string) => {
  let recent = read();
  let existing = Array.isArray(recent[instanceId]) ? recent[instanceId] : [];
  if (existing.includes(skillId)) return;

  write({
    ...recent,
    [instanceId]: [...existing, skillId].slice(-maxRecentSkills)
  });
};

export let useRecentSkillIds = (instanceId: string | null | undefined) => {
  let recent = useSyncExternalStore(subscribe, read, () => emptyRecentSkills);
  let ids = instanceId ? recent[instanceId] : undefined;

  return Array.isArray(ids) ? ids : [];
};

export let useForgetRecentSkill = (instanceId: string | null | undefined) =>
  useCallback(
    (skillId: string) => {
      if (!instanceId) return;

      let recent = read();
      write({
        ...recent,
        [instanceId]: (recent[instanceId] ?? []).filter(id => id != skillId)
      });
    },
    [instanceId]
  );
