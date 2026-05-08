import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import {
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
  ToolTitle,
  unwrapMcpOutput
} from './shared';

type McpItem = Extract<AssistantLiveStateItem, { type: 'tool' }>;

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

  return (
    <ToolSurfaceCard>
      <ToolHeader>
        <ToolHeaderMain>
          <ToolTitle>Tool call</ToolTitle>
          <ToolDetail>{item.tool.name}</ToolDetail>
        </ToolHeaderMain>
      </ToolHeader>

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
          <NestedToolSurfaceCard key={call.id}>
            <ToolHeader>
              <ToolHeaderMain>
                <ToolTitle>{item.tool.name}</ToolTitle>
                <ToolDetail>{getCallSummary(call.input) ?? 'Tool call'}</ToolDetail>
              </ToolHeaderMain>
              <ToolStatusBadge $status={call.status}>{getStatusLabel(call.status)}</ToolStatusBadge>
            </ToolHeader>

            <ToolContentStack>
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
            </ToolContentStack>
          </NestedToolSurfaceCard>
        ))}
      </ToolContentStack>
    </ToolSurfaceCard>
  );
};
