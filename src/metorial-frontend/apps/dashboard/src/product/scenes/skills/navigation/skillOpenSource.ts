import { useSyncExternalStore } from 'react';

export type SkillOpenSource = 'favorites' | 'recent' | `group:${string}`;

type OpenedSkill = { skillId: string; source: SkillOpenSource };

let current: OpenedSkill | null = null;
let listeners = new Set<() => void>();

let subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export let getSkillOpenSource = () => current;

export let setSkillOpenSource = (next: OpenedSkill | null) => {
  if (current?.skillId == next?.skillId && current?.source == next?.source) return;

  current = next;
  listeners.forEach(listener => listener());
};

export let useSkillOpenSource = () =>
  useSyncExternalStore(subscribe, getSkillOpenSource, () => null);

export let getSkillIdFromPath = (pathname: string) =>
  pathname.match(/\/skill\/([^/]+)/)?.[1] ?? null;

export let getSkillGroupIdFromPath = (pathname: string) =>
  pathname.match(/\/skill-group\/([^/]+)/)?.[1] ?? null;
