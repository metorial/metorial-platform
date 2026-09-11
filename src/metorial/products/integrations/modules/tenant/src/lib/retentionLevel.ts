import type { SessionDataRetentionLevel } from '@metorial-subspace/db';

export let retentionLevelStrictnessRank: Record<SessionDataRetentionLevel, number> = {
  full: 0,
  intent_only: 1,
  none: 2
};

export let isRetentionLevelStricter = (d: {
  next: SessionDataRetentionLevel;
  prev: SessionDataRetentionLevel;
}) => retentionLevelStrictnessRank[d.next] > retentionLevelStrictnessRank[d.prev];

export let retentionLevelsLessStrictThan = (level: SessionDataRetentionLevel) =>
  (Object.keys(retentionLevelStrictnessRank) as SessionDataRetentionLevel[]).filter(
    l => retentionLevelStrictnessRank[l] < retentionLevelStrictnessRank[level]
  );
