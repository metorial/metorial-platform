import type { AssistantLiveStateItem } from '@metorial/state';
import { Error, theme } from '@metorial/ui';
import { useMemo } from 'react';
import styled from 'styled-components';
import {
  getDisplayPath,
  ScrollSection,
  ToolContentStack,
  ToolDisclosureCard,
  ToolPathTag,
  ToolSection,
  ToolSectionLabel
} from './shared';

type EditItem = Extract<AssistantLiveStateItem, { type: 'files/write' }>;

type DiffRow = {
  type: 'context' | 'add' | 'remove' | 'fold';
  oldNumber?: number;
  newNumber?: number;
  text: string;
};

let DiffWrapper = styled(ScrollSection)`
  overflow: auto;
`;

let DiffTable = styled.div`
  min-width: 100%;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
`;

let DiffLine = styled.div<{ $type: DiffRow['type'] }>`
  display: grid;
  grid-template-columns: 52px 52px 22px minmax(0, 1fr);
  align-items: stretch;
  background: ${p =>
    p.$type == 'add'
      ? `color-mix(in srgb, ${theme.colors.green800} 8%, ${theme.colors.background})`
      : p.$type == 'remove'
        ? `color-mix(in srgb, ${theme.colors.red800} 8%, ${theme.colors.background})`
        : p.$type == 'fold'
          ? `color-mix(in srgb, ${theme.colors.foreground} 3%, ${theme.colors.background})`
          : 'transparent'};
`;

let DiffLineNumber = styled.div`
  padding: 0 10px 0 8px;
  text-align: right;
  color: color-mix(in srgb, ${theme.colors.foreground} 46%, transparent);
  user-select: none;
  border-right: 1px solid color-mix(in srgb, ${theme.colors.foreground} 7%, transparent);
`;

let DiffMarker = styled.div<{ $type: DiffRow['type'] }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p =>
    p.$type == 'add'
      ? theme.colors.green800
      : p.$type == 'remove'
        ? theme.colors.red800
        : `color-mix(in srgb, ${theme.colors.foreground} 42%, transparent)`};
  user-select: none;
  border-right: 1px solid color-mix(in srgb, ${theme.colors.foreground} 7%, transparent);
`;

let DiffText = styled.pre`
  margin: 0;
  padding: 0 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${theme.colors.foreground};
`;

let EmptyCell = styled.span`
  color: transparent;
`;

let getDiffMarker = (type: DiffRow['type']) => {
  if (type == 'add') return '+';
  if (type == 'remove') return '-';
  if (type == 'fold') return '...';
  return ' ';
};

let buildSimpleRows = (oldLines: string[], newLines: string[]): DiffRow[] => {
  let rows: DiffRow[] = [];
  let max = Math.max(oldLines.length, newLines.length);

  for (let index = 0; index < max; index++) {
    let oldLine = oldLines[index];
    let newLine = newLines[index];

    if (oldLine !== undefined && newLine !== undefined && oldLine == newLine) {
      rows.push({
        type: 'context',
        oldNumber: index + 1,
        newNumber: index + 1,
        text: oldLine
      });
      continue;
    }

    if (oldLine !== undefined) {
      rows.push({
        type: 'remove',
        oldNumber: index + 1,
        text: oldLine
      });
    }

    if (newLine !== undefined) {
      rows.push({
        type: 'add',
        newNumber: index + 1,
        text: newLine
      });
    }
  }

  return rows;
};

let buildDiffRows = (oldText: string, newText: string): DiffRow[] => {
  let oldLines = oldText.split('\n');
  let newLines = newText.split('\n');

  if (oldLines.length * newLines.length > 120000) {
    return buildSimpleRows(oldLines, newLines);
  }

  let table = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0)
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      table[oldIndex][newIndex] =
        oldLines[oldIndex] == newLines[newIndex]
          ? table[oldIndex + 1][newIndex + 1] + 1
          : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1]);
    }
  }

  let rows: DiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] == newLines[newIndex]) {
      rows.push({
        type: 'context',
        oldNumber: oldIndex + 1,
        newNumber: newIndex + 1,
        text: oldLines[oldIndex]
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (table[oldIndex + 1][newIndex] >= table[oldIndex][newIndex + 1]) {
      rows.push({
        type: 'remove',
        oldNumber: oldIndex + 1,
        text: oldLines[oldIndex]
      });
      oldIndex += 1;
    } else {
      rows.push({
        type: 'add',
        newNumber: newIndex + 1,
        text: newLines[newIndex]
      });
      newIndex += 1;
    }
  }

  while (oldIndex < oldLines.length) {
    rows.push({
      type: 'remove',
      oldNumber: oldIndex + 1,
      text: oldLines[oldIndex]
    });
    oldIndex += 1;
  }

  while (newIndex < newLines.length) {
    rows.push({
      type: 'add',
      newNumber: newIndex + 1,
      text: newLines[newIndex]
    });
    newIndex += 1;
  }

  return rows;
};

let collapseContextRows = (rows: DiffRow[]) => {
  let collapsed: DiffRow[] = [];
  let index = 0;

  while (index < rows.length) {
    if (rows[index].type != 'context') {
      collapsed.push(rows[index]);
      index += 1;
      continue;
    }

    let start = index;
    while (index < rows.length && rows[index].type == 'context') index += 1;
    let run = rows.slice(start, index);

    if (run.length <= 8) {
      collapsed.push(...run);
      continue;
    }

    collapsed.push(...run.slice(0, 3));
    collapsed.push({
      type: 'fold',
      text: `${run.length - 6} unchanged lines`
    });
    collapsed.push(...run.slice(-3));
  }

  return collapsed;
};

let getDiffData = (item: EditItem) => {
  if (item.changes.type == 'replace') {
    return {
      oldText: item.changes.oldString,
      newText: item.changes.newString
    };
  }

  if (item.changes.type == 'insert') {
    return {
      oldText: '',
      newText: item.changes.content.join('\n')
    };
  }

  return null;
};

export let EditToolCard = (p: { item: EditItem }) => {
  let item = p.item;
  let displayPath = getDisplayPath(item.path || 'file');
  let verb =
    item.operation == 'write' ? 'Created file' : item.operation == 'delete' ? 'Deleted file' : 'Edited file';

  let diffData = useMemo(() => getDiffData(item), [item]);
  let diffRows = useMemo(() => {
    if (!diffData) return null;
    return collapseContextRows(buildDiffRows(diffData.oldText, diffData.newText));
  }, [diffData]);

  return (
    <ToolDisclosureCard
      summary={`${item.status == 'running' ? verb.replace(/ed /, 'ing ') : verb} ${displayPath}`}
      status={item.status}
      defaultOpen={true}
    >
      <ToolContentStack>
        <ToolPathTag>{displayPath}</ToolPathTag>

        {diffRows && (
          <ToolSection>
            <ToolSectionLabel>Diff</ToolSectionLabel>
            <DiffWrapper>
              <DiffTable>
                {diffRows.map((row, index) => (
                  <DiffLine key={`${item.id}:${index}`} $type={row.type}>
                    <DiffLineNumber>{row.oldNumber ?? <EmptyCell>0</EmptyCell>}</DiffLineNumber>
                    <DiffLineNumber>{row.newNumber ?? <EmptyCell>0</EmptyCell>}</DiffLineNumber>
                    <DiffMarker $type={row.type}>{getDiffMarker(row.type)}</DiffMarker>
                    <DiffText>{row.text || ' '}</DiffText>
                  </DiffLine>
                ))}
              </DiffTable>
            </DiffWrapper>
          </ToolSection>
        )}

        {!diffRows && item.changes.type == 'delete' && (
          <Error>This step deletes `{displayPath}`.</Error>
        )}

        {item.error && <Error>{item.error.message}</Error>}
      </ToolContentStack>
    </ToolDisclosureCard>
  );
};
