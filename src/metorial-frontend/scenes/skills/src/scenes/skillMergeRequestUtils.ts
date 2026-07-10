export type SkillMergeDirection = 'fork_to_upstream' | 'upstream_to_fork';

let getSkillMergeSides = (direction: SkillMergeDirection) =>
  direction === 'upstream_to_fork'
    ? { source: 'upstream', target: 'fork' }
    : { source: 'fork', target: 'upstream' };

export let getSkillMergeChangeLabel = (
  change: string,
  direction: SkillMergeDirection = 'fork_to_upstream'
) =>
  ({
    added: 'Added',
    modified: 'Changed',
    removed: 'Removed',
    unchanged: direction == 'upstream_to_fork' ? 'Already in fork' : 'Already upstream',
    conflicted: 'Conflict'
  })[change] ?? change;

export let getSkillMergeResolutionOptions = (
  entry: {
    item: {
      kind: 'file' | 'document' | 'directory';
      changeType: 'added' | 'modified' | 'removed' | 'unchanged' | 'conflicted';
    };
    source?: unknown;
  },
  direction: SkillMergeDirection = 'fork_to_upstream'
) => {
  let item = entry.item;
  let sides = getSkillMergeSides(direction);
  let noSource = item.changeType == 'removed' || (item.kind != 'directory' && !entry.source);

  if (noSource) {
    return [
      { id: 'remove', label: 'Apply removal' },
      { id: 'keep_target', label: `Keep ${sides.target}` },
      { id: 'skip', label: 'Skip' }
    ];
  }

  if (item.kind == 'document') {
    return [
      { id: 'accept_source', label: `Use ${sides.source} version` },
      { id: 'edit_document', label: 'Edit result' },
      { id: 'keep_target', label: `Keep ${sides.target}` },
      { id: 'skip', label: 'Skip' }
    ];
  }

  if (item.kind == 'file') {
    return [
      { id: 'accept_source', label: `Use ${sides.source} file` },
      { id: 'replace_file', label: 'Choose another file' },
      { id: 'keep_target', label: `Keep ${sides.target}` },
      { id: 'skip', label: 'Skip' }
    ];
  }

  return [
    { id: 'accept_source', label: `Use ${sides.source} directory` },
    { id: 'remove', label: 'Remove directory' },
    { id: 'keep_target', label: `Keep ${sides.target}` },
    { id: 'skip', label: 'Skip' }
  ];
};

export let getSkillMergeErrorMessage = (
  code: string | null | undefined,
  direction: SkillMergeDirection = 'fork_to_upstream'
) => {
  let { target } = getSkillMergeSides(direction);

  if (code === 'target_changed' || code === 'unresolved_after_refresh') {
    return `The ${target} changed while merging. Review the outstanding choices and try again; the preview now shows the refreshed ${target} snapshot.`;
  }
  if (code === 'verification_failed') {
    return 'The proposed result could not be verified, so the merge was not marked complete. Review the request and try again.';
  }
  if (code === 'enqueue_failed' || code === 'stale_merge_recovered') {
    return 'The merge worker did not finish. No completed merge was recorded; review the request and try again.';
  }
  return 'The merge could not be applied. Review the request and try again.';
};

export let getSkillMergeItemStatusLabel = (
  item: {
    status: string;
    resolutionType?: string | null;
    conflictReason?: string | null;
  },
  direction: SkillMergeDirection = 'fork_to_upstream'
) => {
  let sides = getSkillMergeSides(direction);

  if (item.status === 'unresolved') return 'Needs review';
  if (item.conflictReason === 'already_merged_upstream') return `Already in ${sides.target}`;
  if (item.status === 'applied') {
    if (item.resolutionType === 'accept_source') return `Applied ${sides.source} version`;
    if (item.resolutionType === 'edit_document') return 'Applied edited version';
    if (item.resolutionType === 'replace_file') return 'Applied replacement file';
    if (item.resolutionType === 'remove') return 'Applied removal';
    return 'Applied';
  }
  if (item.resolutionType === 'keep_target') return `Kept ${sides.target}`;
  if (item.resolutionType === 'skip') return 'Skipped';
  return 'Resolved';
};
