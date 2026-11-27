import React from 'react';
import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import {
  extractCommandSummary,
  JsonBlock,
  normalizeCommandForDisplay,
  ToolContentStack,
  ToolDisclosureCard
} from './shared';

type BashItem = Extract<AssistantLiveStateItem, { type: 'shell' }>;

export let BashToolCard = (p: { item: BashItem }) => {
  let item = p.item;
  let command = normalizeCommandForDisplay(item.command);
  let summary = extractCommandSummary(item.command) || command || 'command';
  let output = [item.stdout.trim(), item.stderr.trim()].filter(Boolean).join('\n');
  let block = output ? `$ ${command}\n${output}` : `$ ${command}`;

  return (
    <ToolDisclosureCard
      summary={`${item.status == 'running' ? 'Running' : 'Ran'} command ${summary}`}
      status={item.status}
      defaultOpen={true}
      autoCollapseOnComplete={!item.error}
    >
      <ToolContentStack>
        <JsonBlock value={block} language="bash" />
        {item.error && <Error>{item.error.message}</Error>}
      </ToolContentStack>
    </ToolDisclosureCard>
  );
};
