import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import styled from 'styled-components';
import {
  JsonBlock,
  ToolContentStack,
  ToolDisclosureCard,
  ToolSection,
  ToolSectionLabel,
  unwrapMcpOutput
} from './shared';

type McpItem = Extract<AssistantLiveStateItem, { type: 'tool' }>;

let CallBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 6px 10px 0;

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

  let entries = Object.entries(input).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  if (!entries.length) return null;

  return entries
    .slice(0, 2)
    .map(([key, value]) => {
      let text = typeof value == 'string' ? value : JSON.stringify(value);
      return `${key}: ${text.length > 36 ? `${text.slice(0, 33)}...` : text}`;
    })
    .join('  ');
};

type ToolPresentation = {
  running: string;
  done: string;
  secondary?: (calls: McpItem['calls']) => string | null;
};

let getRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value == 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

let metadataFieldLabels: Record<string, string> = {
  name: 'name',
  description: 'description',
  clientName: 'client name',
  clientDescription: 'client description'
};

let toolPresentations: Record<string, ToolPresentation> = {
  read_document: {
    running: 'Reading document',
    done: 'Read document',
    secondary: calls => {
      let titles = calls
        .map(call => getRecord(unwrapMcpOutput(call.output)).title)
        .filter((title): title is string => typeof title == 'string' && !!title);
      return titles.length ? titles[titles.length - 1]! : null;
    }
  },
  update_skill_metadata: {
    running: 'Updating skill details',
    done: 'Updated skill details',
    secondary: calls => {
      let fields = new Set<string>();
      for (let call of calls) {
        for (let [key, value] of Object.entries(getRecord(call.input))) {
          if (value !== undefined && metadataFieldLabels[key]) {
            fields.add(metadataFieldLabels[key]!);
          }
        }
      }
      return fields.size ? [...fields].join(', ') : null;
    }
  },
  write_client_description: {
    running: 'Writing client description',
    done: 'Wrote client description'
  }
};

export let McpToolCard = (p: { item: McpItem }) => {
  let item = p.item;
  let status: 'running' | 'completed' | 'failed' = item.calls.some(
    call => call.status == 'failed'
  )
    ? 'failed'
    : item.calls.some(call => call.status == 'running')
      ? 'running'
      : 'completed';

  let presentation = toolPresentations[item.tool.key];
  let errors = item.calls.filter(call => call.error);

  let summary = presentation
    ? status == 'running'
      ? presentation.running
      : presentation.done
    : `${status == 'running' ? 'Running' : 'Ran'} tool ${item.tool.name}`;

  if (presentation) {
    return (
      <ToolDisclosureCard
        summary={summary}
        secondaryText={presentation.secondary?.(item.calls)}
        status={status}
      >
        {errors.length ? (
          <ToolContentStack>
            {errors.map(call => (
              <Error key={call.id}>{call.error!.message}</Error>
            ))}
          </ToolContentStack>
        ) : undefined}
      </ToolDisclosureCard>
    );
  }

  return (
    <ToolDisclosureCard summary={summary} status={status} defaultOpen={true}>
      <ToolContentStack>
        {item.calls.map(call => (
          <CallBlock key={call.id}>
            {/* <div>
              <CallTitle>{item.tool.name}</CallTitle>
              <CallSummary>{getCallSummary(call.input) ?? 'Tool call'}</CallSummary>
            </div> */}

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
