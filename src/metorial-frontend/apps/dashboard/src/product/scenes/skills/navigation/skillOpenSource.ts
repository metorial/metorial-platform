import { useSyncExternalStore } from 'react';

export type SkillOpenSource = 'favorites' | 'recent' | `group:${string}`;

let emptySources: Record<string, SkillOpenSource> = {};

let current = emptySources;
let listeners = new Set<() => void>();

let write = (next: Record<string, SkillOpenSource>) => {
  current = next;
  listeners.forEach(listener => listener());
};

let subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export let getSkillOpenSource = (skillId: string) => current[skillId];

export let setSkillOpenSource = (skillId: string, source: SkillOpenSource) => {
  if (current[skillId] == source) return;
  write({ ...current, [skillId]: source });
};

export let retainSkillOpenSource = (skillId: string | null) => {
  let source = skillId ? current[skillId] : undefined;
  let keys = Object.keys(current);
  if (keys.length == 0 || (keys.length == 1 && source)) return;

  write(skillId && source ? { [skillId]: source } : emptySources);
};

export let useSkillOpenSources = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => emptySources
  );

export let getSkillIdFromPath = (pathname: string) =>
  pathname.match(/\/skill\/([^/]+)/)?.[1] ?? null;

export let getSkillGroupIdFromPath = (pathname: string) =>
  pathname.match(/\/skill-group\/([^/]+)/)?.[1] ?? null;
