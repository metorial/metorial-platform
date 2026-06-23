import React from 'react';
import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import styled from 'styled-components';
import { getDisplayPath, ToolContentStack, ToolDisclosureCard } from './shared';

type SearchItem = Extract<AssistantLiveStateItem, { type: 'files/explore' }>;

let OperationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let OperationRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;

  & + & {
    border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);
  }
`;

let OperationTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
`;

let OperationDetail = styled.div`
  font-size: 12px;
  color: color-mix(in srgb, currentColor 58%, transparent);
  word-break: break-word;
  min-width: 0;
`;

let EmptyNote = styled.div`
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 8%, transparent);
  color: color-mix(in srgb, currentColor 58%, transparent);
  font-size: 12px;
  line-height: 1.5;
  padding: 10px 12px;
`;

let getOperationTitle = (type: SearchItem['operations'][number]['type']) => {
  return type == 'read' ? 'Read' : 'Explore';
};

let getOperationDetail = (operation: SearchItem['operations'][number]) => {
  if (operation.type == 'read') return getDisplayPath(operation.path);

  let base = operation.path ? getDisplayPath(operation.path) : 'Workspace';
  return operation.pattern ? `${operation.pattern} in ${base}` : base;
};

let getExploredCount = (item: SearchItem) => {
  let total = 0;

  for (let operation of item.operations) {
    let output = operation.output;

    if (Array.isArray(output)) {
      total += output.length;
      continue;
    }

    if (output && typeof output == 'object' && 'numFiles' in output) {
      let numFiles = (output as { numFiles?: unknown }).numFiles;
      if (typeof numFiles == 'number') total += numFiles;
    }
  }

  return total > 0 ? total : null;
};

export let SearchToolCard = (p: { item: SearchItem }) => {
  let item = p.item;
  let exploredCount = getExploredCount(item);
  let isRunning = item.operations.some(operation => operation.status == 'running');
  let hasFailed = item.operations.some(operation => operation.status == 'failed');
  let hasFoundFiles = exploredCount != null;
  let showEmptyNote = !isRunning && !hasFailed && !hasFoundFiles;
  let summary = isRunning
    ? 'Exploring files'
    : hasFoundFiles
      ? `Explored ${exploredCount} files`
      : 'Explored files';

  return (
    <ToolDisclosureCard
      summary={summary}
      status={hasFailed ? 'failed' : isRunning ? 'running' : 'completed'}
      defaultOpen={true}
      autoCollapseOnComplete={!hasFailed}
    >
      <ToolContentStack>
        <OperationList>
          {item.operations.map(operation => (
            <OperationRow key={operation.id}>
              <OperationTitle>{getOperationTitle(operation.type)}</OperationTitle>
              <OperationDetail>{getOperationDetail(operation)}</OperationDetail>
              {operation.error && <Error>{operation.error.message}</Error>}
            </OperationRow>
          ))}
        </OperationList>

        {showEmptyNote && <EmptyNote>No files were found for this exploration.</EmptyNote>}
      </ToolContentStack>
    </ToolDisclosureCard>
  );
};
