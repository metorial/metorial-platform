import React from 'react';
import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import styled from 'styled-components';
import {
  JsonBlock,
  ToolContentStack,
  ToolDisclosureCard,
  ToolMetaChip,
  ToolMetaRow,
  ToolSection,
  ToolSectionLabel,
  unwrapMcpOutput
} from './shared';

type McpItem = Extract<AssistantLiveStateItem, { type: 'tool' }>;

let CallBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;

  & + & {
    border-top: 1px solid color-mix(in srgb, currentColor 8%, transparent);
  }
`;

let CallTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
`;

let CallSummary = styled.div`
  font-size: 12px;
  color: color-mix(in srgb, currentColor 58%, transparent);
  word-break: break-word;
`;

let getCallSummary = (input: unknown) => {
  if (!input || typeof input != 'object' || Array.isArray(input)) return null;

  let entries = Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return null;

  return entries
    .slice(0, 2)
    .map(([key, value]) => {
      let text = typeof value == 'string' ? value : JSON.stringify(value);
      return `${key}: ${text.length > 36 ? `${text.slice(0, 33)}...` : text}`;
    })
    .join('  ');
};

export let McpToolCard = (p: { item: McpItem }) => {
  let item = p.item;
  let status: 'running' | 'completed' | 'failed' = item.calls.some(call => call.status == 'failed')
    ? 'failed'
    : item.calls.some(call => call.status == 'running')
      ? 'running'
      : 'completed';

  return (
    <ToolDisclosureCard
      summary={`${status == 'running' ? 'Running' : 'Ran'} tool ${item.tool.name}`}
      status={status}
      defaultOpen={true}
    >
      <ToolContentStack>
        <ToolMetaRow>
          <ToolMetaChip>{item.calls.length} call{item.calls.length == 1 ? '' : 's'}</ToolMetaChip>
          {item.calls.some(call => call.status == 'running') && (
            <ToolMetaChip $tone="warning">running</ToolMetaChip>
          )}
          {item.calls.some(call => call.status == 'failed') && (
            <ToolMetaChip $tone="danger">errors</ToolMetaChip>
          )}
        </ToolMetaRow>

        {item.calls.map(call => (
          <CallBlock key={call.id}>
            <div>
              <CallTitle>{item.tool.name}</CallTitle>
              <CallSummary>{getCallSummary(call.input) ?? 'Tool call'}</CallSummary>
            </div>

            <ToolSection>
              <ToolSectionLabel>Input</ToolSectionLabel>
              <JsonBlock value={call.input} />
            </ToolSection>

            {call.output !== undefined && (
              <ToolSection>
                <ToolSectionLabel>Output</ToolSectionLabel>
                <JsonBlock value={unwrapMcpOutput(call.output)} />
              </ToolSection>
            )}

            {call.error && <Error>{call.error.message}</Error>}
          </CallBlock>
        ))}
      </ToolContentStack>
    </ToolDisclosureCard>
  );
};
