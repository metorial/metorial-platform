import { generatePlainId } from '@lowerdeck/id';

let maxBranchNameLength = 50;
let truncatedBranchPrefixLength = 45;

let normalizeBranchSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export let normalizeSkillSyncBranchName = (value: string) => {
  let normalized = normalizeBranchSegment(value) || 'metorial-sync-repository';
  if (normalized.length <= maxBranchNameLength) return normalized;

  return `${normalized.slice(0, truncatedBranchPrefixLength)}${generatePlainId(5).toLowerCase()}`;
};

export let createSkillSyncBranchName = (d: {
  target: string;
  syncCounter: number;
  suffix: string;
}) => {
  let prefix = 'metorial-sync-';
  let suffix = normalizeBranchSegment(`${d.syncCounter}-${d.suffix}`).slice(-24);
  let target = normalizeBranchSegment(d.target) || 'repository';

  return normalizeSkillSyncBranchName(`${prefix}${target}-${suffix}`);
};
