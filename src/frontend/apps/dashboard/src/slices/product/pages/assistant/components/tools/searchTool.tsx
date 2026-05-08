import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import {
  getDisplayPath,
  getStatusLabel,
  JsonBlock,
  NestedToolSurfaceCard,
  ToolContentStack,
  ToolDetail,
  ToolHeader,
  ToolHeaderMain,
  ToolMetaChip,
  ToolMetaRow,
  ToolSection,
  ToolSectionLabel,
  ToolStatusBadge,
  ToolSurfaceCard,
  ToolTitle
} from './shared';

type SearchItem = Extract<AssistantLiveStateItem, { type: 'files/explore' }>;

let getOperationTitle = (type: SearchItem['operations'][number]['type']) => {
  return type == 'read' ? 'Read file' : 'Searched files';
};

let getOperationDetail = (operation: SearchItem['operations'][number]) => {
  if (operation.type == 'read') return getDisplayPath(operation.path);

  let base = operation.path ? getDisplayPath(operation.path) : 'Workspace';
  return operation.pattern ? `${operation.pattern} in ${base}` : base;
};

let renderOperationOutput = (output: unknown) => {
  if (output === undefined) return null;

  if (Array.isArray(output) && output.every(value => typeof value == 'string')) {
    return (
      <ToolSection>
        <ToolSectionLabel>Results</ToolSectionLabel>
        <JsonBlock value={output.join('\n')} language="text" />
      </ToolSection>
    );
  }

  if (typeof output == 'string') {
    return (
      <ToolSection>
        <ToolSectionLabel>Results</ToolSectionLabel>
        <JsonBlock value={output} language="text" />
      </ToolSection>
    );
  }

  return (
    <ToolSection>
      <ToolSectionLabel>Results</ToolSectionLabel>
      <JsonBlock value={output} />
    </ToolSection>
  );
};

export let SearchToolCard = (p: { item: SearchItem }) => {
  let item = p.item;
  let completedCount = item.operations.filter(operation => operation.status == 'completed').length;

  return (
    <ToolSurfaceCard>
      <ToolHeader>
        <ToolHeaderMain>
          <ToolTitle>Search</ToolTitle>
          <ToolDetail>
            {item.operations.length} operation{item.operations.length == 1 ? '' : 's'}
          </ToolDetail>
        </ToolHeaderMain>
      </ToolHeader>

      <ToolContentStack>
        <ToolMetaRow>
          <ToolMetaChip>{completedCount} completed</ToolMetaChip>
          {item.operations.some(operation => operation.status == 'running') && (
            <ToolMetaChip $tone="warning">running</ToolMetaChip>
          )}
          {item.operations.some(operation => operation.status == 'failed') && (
            <ToolMetaChip $tone="danger">errors</ToolMetaChip>
          )}
        </ToolMetaRow>

        {item.operations.map(operation => (
          <NestedToolSurfaceCard key={operation.id}>
            <ToolHeader>
              <ToolHeaderMain>
                <ToolTitle>{getOperationTitle(operation.type)}</ToolTitle>
                <ToolDetail>{getOperationDetail(operation)}</ToolDetail>
              </ToolHeaderMain>
              <ToolStatusBadge $status={operation.status}>
                {getStatusLabel(operation.status)}
              </ToolStatusBadge>
            </ToolHeader>

            <ToolContentStack>
              {renderOperationOutput(operation.output)}
              {operation.error && <Error>{operation.error.message}</Error>}
            </ToolContentStack>
          </NestedToolSurfaceCard>
        ))}
      </ToolContentStack>
    </ToolSurfaceCard>
  );
};
