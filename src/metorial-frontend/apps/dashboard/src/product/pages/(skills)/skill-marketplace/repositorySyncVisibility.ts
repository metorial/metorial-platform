import type { SkillSync } from '@metorial/state';

let delayedLogThresholdMs = 5 * 60 * 1000;

export let shouldShowRepositorySyncLogs = (sync: SkillSync, now = Date.now()) => {
  if (sync.status === 'failed') return true;
  if (sync.status !== 'processing') return false;

  let startedAt = sync.startedAt ?? sync.createdAt;
  return now - new Date(startedAt).getTime() > delayedLogThresholdMs;
};
