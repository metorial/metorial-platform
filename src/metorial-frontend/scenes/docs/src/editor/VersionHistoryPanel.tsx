import { Panel, RenderDate } from '@metorial/ui';
import type { StructuredPatchHunk } from 'diff';
import { structuredPatch } from 'diff';
import { useMemo } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';

export interface VersionEditor {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface DocumentVersion {
  id: string;
  content: string;
  versionNumber: number;
  createdAt: string | Date;
  /** Snake-case to mirror the API contract documented by the consumer. */
  previous_version_id?: string;
  editors: VersionEditor[];
}

interface VersionHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DocumentVersion[];
  /** Number of unchanged context lines rendered around each modified
   *  region. Defaults to 3, matching what most diff viewers show. */
  contextLines?: number;
}

let HeaderTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
`;

let HeaderCount = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.textMuted};
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.bgAlt};
`;

let Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0 12px;
`;

let VersionCard = styled.section`
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  background: ${({ theme }) => theme.color.bgElevated};
  overflow: hidden;
`;

let VersionHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
`;

let VersionTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

let VersionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
`;

let InitialBadge = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.accent};
  padding: 1px 7px;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.accentSoft};
`;

let VersionSubtitle = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.color.textMuted};
`;

let Editors = styled.div`
  display: flex;
  align-items: center;
`;

let EditorAvatar = styled.div`
  margin-left: -6px;
  display: inline-flex;
  border: 2px solid ${({ theme }) => theme.color.bg};
  border-radius: 999px;

  &:first-child {
    margin-left: 0;
  }
`;

let Diff = styled.pre`
  margin: 0;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre;
  overflow: auto;
  max-height: 360px;
  background: ${({ theme }) => theme.color.bgElevated};
`;

let HunkHeader = styled.div`
  padding: 6px 14px;
  font-size: 11px;
  color: ${({ theme }) => theme.color.textSubtle};
  background: ${({ theme }) => theme.color.bgAlt};
  border-top: 1px dashed ${({ theme }) => theme.color.border};

  &:first-child {
    border-top: 0;
  }
`;

interface DiffLineRowProps {
  $kind: 'add' | 'remove' | 'context';
}

let DiffLineRow = styled.div<DiffLineRowProps>`
  display: grid;
  grid-template-columns: 44px 44px 14px 1fr;
  align-items: stretch;
  font-variant-numeric: tabular-nums;

  background: ${({ $kind }) =>
    $kind === 'add'
      ? 'rgba(34, 197, 94, 0.10)'
      : $kind === 'remove'
        ? 'rgba(239, 68, 68, 0.10)'
        : 'transparent'};
`;

let LineNum = styled.span<{ $kind: 'add' | 'remove' | 'context' }>`
  padding: 0 6px;
  text-align: right;
  user-select: none;
  color: ${({ theme }) => theme.color.textSubtle};
  background: ${({ $kind }) =>
    $kind === 'add'
      ? 'rgba(34, 197, 94, 0.18)'
      : $kind === 'remove'
        ? 'rgba(239, 68, 68, 0.18)'
        : 'transparent'};
  border-right: 1px solid
    ${({ $kind, theme }) => ($kind === 'context' ? theme.color.border : 'transparent')};
`;

let LineMarker = styled.span<{ $kind: 'add' | 'remove' | 'context' }>`
  display: inline-flex;
  justify-content: center;
  user-select: none;
  font-weight: 600;
  color: ${({ $kind }) =>
    $kind === 'add'
      ? 'rgb(21, 128, 61)'
      : $kind === 'remove'
        ? 'rgb(185, 28, 28)'
        : 'transparent'};
`;

let LineContent = styled.span<{ $kind: 'add' | 'remove' | 'context' }>`
  padding: 0 12px 0 4px;
  color: ${({ $kind, theme }) =>
    $kind === 'context' ? theme.color.textMuted : theme.color.text};
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
`;

let NoChangesRow = styled.div`
  padding: 14px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.color.textMuted};
  text-align: center;
  font-style: italic;
`;

let EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: 13px;
`;

interface ParsedLine {
  kind: 'add' | 'remove' | 'context';
  content: string;
  oldNum: number | null;
  newNum: number | null;
}

/**
 * Walk the lines of a single hunk (which use the unified-diff prefix
 * conventions: `+`, `-`, ` `, and `\\` for "no newline at end of file"
 * markers, the latter of which we silently drop) and produce structured
 * rows with running line numbers for each side.
 */
function parseHunkLines(hunk: StructuredPatchHunk): ParsedLine[] {
  let out: ParsedLine[] = [];
  let oldNum = hunk.oldStart;
  let newNum = hunk.newStart;
  for (let raw of hunk.lines) {
    if (raw.startsWith('\\')) continue;
    let prefix = raw[0];
    let content = raw.slice(1);
    if (prefix === '+') {
      out.push({ kind: 'add', content, oldNum: null, newNum });
      newNum += 1;
    } else if (prefix === '-') {
      out.push({ kind: 'remove', content, oldNum, newNum: null });
      oldNum += 1;
    } else {
      out.push({ kind: 'context', content, oldNum, newNum });
      oldNum += 1;
      newNum += 1;
    }
  }
  return out;
}

function formatEditorList(editors: VersionEditor[]): string {
  if (editors.length === 0) return 'Unknown editor';
  if (editors.length === 1) return `Edited by ${editors[0].name}`;
  if (editors.length === 2) {
    return `Edited by ${editors[0].name} and ${editors[1].name}`;
  }
  return `Edited by ${editors[0].name} and ${editors.length - 1} others`;
}

interface VersionDiffViewProps {
  hunks: StructuredPatchHunk[];
  /** When true, the version had no previous content (initial version)
   *  so we want to label it as such. */
  isInitial: boolean;
  /** When true, the previous and current content were equal. */
  noChanges: boolean;
}

function VersionDiffView({ hunks, isInitial, noChanges }: VersionDiffViewProps) {
  if (noChanges) {
    return <NoChangesRow>No content changes</NoChangesRow>;
  }
  if (hunks.length === 0) {
    return <NoChangesRow>No content changes</NoChangesRow>;
  }
  return (
    <Diff>
      {hunks.map((hunk, i) => {
        let lines = parseHunkLines(hunk);
        let header = isInitial ? `+${hunk.newLines} lines` : `@@ ${formatHunkRange(hunk)} @@`;
        return (
          <div key={i}>
            <HunkHeader>{header}</HunkHeader>
            {lines.map((line, j) => (
              <DiffLineRow key={j} $kind={line.kind}>
                <LineNum $kind={line.kind}>{line.oldNum ?? ''}</LineNum>
                <LineNum $kind={line.kind}>{line.newNum ?? ''}</LineNum>
                <LineMarker $kind={line.kind}>
                  {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}
                </LineMarker>
                <LineContent $kind={line.kind}>
                  {line.content === '' ? '\u00A0' : line.content}
                </LineContent>
              </DiffLineRow>
            ))}
          </div>
        );
      })}
    </Diff>
  );
}

function formatHunkRange(hunk: StructuredPatchHunk): string {
  let oldRange = `-${hunk.oldStart},${hunk.oldLines}`;
  let newRange = `+${hunk.newStart},${hunk.newLines}`;
  return `${oldRange} ${newRange}`;
}

interface ResolvedVersion {
  version: DocumentVersion;
  hunks: StructuredPatchHunk[];
  isInitial: boolean;
  noChanges: boolean;
}

export function VersionHistoryPanel({
  open,
  onOpenChange,
  versions,
  contextLines = 3
}: VersionHistoryPanelProps) {
  let resolved = useMemo<ResolvedVersion[]>(() => {
    let byId = new Map(versions.map(v => [v.id, v]));
    let sorted = [...versions].sort((a, b) => {
      let aTime = new Date(a.createdAt).getTime();
      let bTime = new Date(b.createdAt).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return b.versionNumber - a.versionNumber;
    });
    return sorted
      .map(v => {
        let prev = v.previous_version_id ? byId.get(v.previous_version_id) : undefined;
        let prevContent = prev ? prev.content : '';
        let isInitial = !prev;
        let noChanges = !isInitial && prevContent === v.content;
        let patch = structuredPatch(
          'previous',
          'current',
          prevContent,
          v.content,
          undefined,
          undefined,
          { context: contextLines }
        );
        return {
          version: v,
          hunks: patch.hunks,
          isInitial,
          noChanges
        };
      })
      // Skill merge requests can create empty intermediate versions with no
      // content diff — hide those so the history only shows real edits.
      .filter(v => !v.noChanges);
  }, [versions, contextLines]);

  return (
    <Panel.Wrapper isOpen={open} onOpenChange={onOpenChange} width={640}>
      <Panel.Header>
        <HeaderTitle>
          Version History
          <HeaderCount>{resolved.length}</HeaderCount>
        </HeaderTitle>
      </Panel.Header>
      <Panel.Content>
        <Body>
          {resolved.length === 0 ? (
            <EmptyState>No versions have been saved yet.</EmptyState>
          ) : (
            resolved.map(({ version, hunks, isInitial, noChanges }) => (
              <VersionCard key={version.id}>
                <VersionHeader>
                  <VersionTitleGroup>
                    <VersionLabel>
                      <RenderDate date={version.createdAt} />
                      {isInitial && <InitialBadge>Initial</InitialBadge>}
                    </VersionLabel>
                    <VersionSubtitle>{formatEditorList(version.editors)}</VersionSubtitle>
                  </VersionTitleGroup>
                  <Editors>
                    {version.editors.map(editor => (
                      <EditorAvatar key={editor.id} title={editor.name}>
                        <Avatar
                          name={editor.name}
                          imageUrl={editor.imageUrl}
                          size={26}
                          noTooltip
                        />
                      </EditorAvatar>
                    ))}
                  </Editors>
                </VersionHeader>
                <VersionDiffView hunks={hunks} isInitial={isInitial} noChanges={noChanges} />
              </VersionCard>
            ))
          )}
        </Body>
      </Panel.Content>
    </Panel.Wrapper>
  );
}
