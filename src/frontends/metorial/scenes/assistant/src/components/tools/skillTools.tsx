import type { AssistantLiveStateItem } from '@metorial/state';
import { theme } from '@metorial/ui';
import styled from 'styled-components';
import { ToolDisclosureCard, ToolMetaChip, ToolMetaRow, getDisplayPath } from './shared';

type DocumentEditItem = Extract<AssistantLiveStateItem, { type: 'document/edit' }>;
type SkillChangesItem = Extract<AssistantLiveStateItem, { type: 'skill/changes' }>;

let OperationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let OperationRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 8%, transparent);
`;

let OperationTarget = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: color-mix(in srgb, ${theme.colors.foreground} 70%, transparent);
`;

let OperationPreview = styled.pre`
  margin: 0;
  max-height: 160px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${theme.colors.foreground};
`;

let OperationError = styled.span`
  font-size: 12px;
  color: ${theme.colors.red800};
`;

let ChangeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: ${theme.colors.foreground};
`;

let ChangePath = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let operationLabels: Record<DocumentEditItem['operations'][number]['kind'], string> = {
  replace: 'Replace',
  insert_before: 'Insert before',
  insert_after: 'Insert after',
  delete: 'Delete'
};

let describeTarget = (target: string) => {
  if (target == '@title') return 'title';
  if (target == '@frontMatter') return 'front matter';
  if (target == 'doc_start') return 'start of document';
  if (target == 'doc_end') return 'end of document';
  if (target == 'selection') return 'selection';
  if (target == 'block' || target == 'anchor') return 'agent block';
  return target;
};

let changeTones = {
  create: 'added',
  modify: 'default',
  delete: 'removed',
  move: 'warning'
} as const;

export let DocumentEditToolCard = (p: { item: DocumentEditItem }) => {
  let operations = p.item.operations;
  let summary =
    p.item.review == 'pending'
      ? p.item.status == 'running'
        ? 'Drafting changes'
        : 'Drafted changes for review'
      : p.item.status == 'running'
        ? 'Editing document'
        : 'Edited document';

  return (
    <ToolDisclosureCard
      summary={summary}
      secondaryText={`${operations.length} ${operations.length == 1 ? 'change' : 'changes'}`}
      status={p.item.status}
      defaultOpen={false}
    >
      {operations.length ? (
        <OperationList>
          {operations.map((operation, index) => (
            <OperationRow key={index}>
              <OperationTarget>
                {operationLabels[operation.kind]} · {describeTarget(operation.target)}
                {operation.targetEnd ? ` – ${describeTarget(operation.targetEnd)}` : ''}
              </OperationTarget>
              {operation.content ? (
                <OperationPreview>{operation.content}</OperationPreview>
              ) : null}
              {operation.error ? <OperationError>{operation.error}</OperationError> : null}
            </OperationRow>
          ))}
        </OperationList>
      ) : undefined}
    </ToolDisclosureCard>
  );
};

export let SkillChangesToolCard = (p: { item: SkillChangesItem }) => {
  let failed = p.item.changes.filter(change => change.status == 'failed').length;

  return (
    <ToolDisclosureCard
      summary="Saved skill files"
      secondaryText={`${p.item.changes.length} ${
        p.item.changes.length == 1 ? 'file' : 'files'
      }${failed ? `, ${failed} failed` : ''}`}
      status={failed ? 'failed' : 'completed'}
      defaultOpen={false}
    >
      <OperationList>
        {p.item.changes.map((change, index) => (
          <ChangeRow key={`${change.path}:${index}`}>
            <ChangePath title={change.error ?? change.path}>
              {change.fromPath
                ? `${getDisplayPath(change.fromPath)} → ${getDisplayPath(change.path)}`
                : getDisplayPath(change.path)}
            </ChangePath>
            <ToolMetaRow>
              <ToolMetaChip
                data-tone={change.status == 'failed' ? 'danger' : changeTones[change.op]}
              >
                {change.status == 'failed' ? 'failed' : change.op}
              </ToolMetaChip>
            </ToolMetaRow>
          </ChangeRow>
        ))}
      </OperationList>
    </ToolDisclosureCard>
  );
};
