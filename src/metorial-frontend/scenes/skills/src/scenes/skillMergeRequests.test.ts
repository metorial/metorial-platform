import { describe, expect, it } from 'vitest';
import {
  getSkillMergeChangeLabel,
  getSkillMergeErrorMessage,
  getSkillMergeItemStatusLabel,
  getSkillMergeResolutionOptions
} from './skillMergeRequestUtils';

let entry = (input: {
  kind: 'file' | 'document' | 'directory';
  changeType: 'added' | 'modified' | 'removed' | 'unchanged' | 'conflicted';
  hasSource?: boolean;
}) =>
  ({
    item: {
      kind: input.kind,
      changeType: input.changeType
    },
    source: input.hasSource === false ? null : { path: '/change' }
  }) as any;

let ids = (input: ReturnType<typeof entry>) =>
  getSkillMergeResolutionOptions(input).map(option => option.id);

let labels = (
  input: ReturnType<typeof entry>,
  direction: 'fork_to_upstream' | 'upstream_to_fork'
) => getSkillMergeResolutionOptions(input, direction).map(option => option.label);

describe('skill merge resolution options', () => {
  it('offers edit and keep-upstream for documents', () => {
    expect(ids(entry({ kind: 'document', changeType: 'conflicted' }))).toEqual([
      'accept_source',
      'edit_document',
      'keep_target',
      'skip'
    ]);
  });

  it('offers replacement and keep-upstream for files', () => {
    expect(ids(entry({ kind: 'file', changeType: 'modified' }))).toEqual([
      'accept_source',
      'replace_file',
      'keep_target',
      'skip'
    ]);
  });

  it('only offers deletion or no-op choices without a source', () => {
    expect(
      ids(entry({ kind: 'document', changeType: 'conflicted', hasSource: false }))
    ).toEqual(['remove', 'keep_target', 'skip']);
  });

  it('supports explicit directory removal', () => {
    expect(ids(entry({ kind: 'directory', changeType: 'added' }))).toContain('remove');
  });

  it('uses upstream source and fork target labels for upstream syncs', () => {
    expect(
      labels(entry({ kind: 'document', changeType: 'conflicted' }), 'upstream_to_fork')
    ).toContain('Use upstream version');
    expect(
      labels(entry({ kind: 'file', changeType: 'modified' }), 'upstream_to_fork')
    ).toContain('Use upstream file');
    expect(
      labels(entry({ kind: 'directory', changeType: 'added' }), 'upstream_to_fork')
    ).toContain('Use upstream directory');
    expect(
      labels(entry({ kind: 'document', changeType: 'conflicted' }), 'upstream_to_fork')
    ).toContain('Keep fork');
  });
});

describe('skill merge result messaging', () => {
  it('only attributes actual refresh conflicts to upstream changes', () => {
    expect(getSkillMergeErrorMessage('unresolved_after_refresh')).toContain(
      'upstream changed'
    );
    expect(getSkillMergeErrorMessage('verification_failed')).not.toContain('upstream changed');
    expect(getSkillMergeErrorMessage('apply_failed')).not.toContain('upstream changed');
  });

  it('retains the selected resolution in applied labels', () => {
    expect(
      getSkillMergeItemStatusLabel({
        status: 'applied',
        resolutionType: 'accept_source'
      })
    ).toBe('Applied fork version');
    expect(
      getSkillMergeItemStatusLabel({
        status: 'skipped',
        resolutionType: 'skip',
        conflictReason: 'already_merged_upstream'
      })
    ).toBe('Already in upstream');
  });

  it('describes upstream-to-fork results from the correct direction', () => {
    expect(
      getSkillMergeErrorMessage('unresolved_after_refresh', 'upstream_to_fork')
    ).toContain('fork changed');
    expect(
      getSkillMergeItemStatusLabel(
        {
          status: 'applied',
          resolutionType: 'accept_source'
        },
        'upstream_to_fork'
      )
    ).toBe('Applied upstream version');
    expect(
      getSkillMergeItemStatusLabel(
        {
          status: 'skipped',
          resolutionType: 'keep_target'
        },
        'upstream_to_fork'
      )
    ).toBe('Kept fork');
    expect(getSkillMergeChangeLabel('unchanged', 'upstream_to_fork')).toBe('Already in fork');
  });
});
