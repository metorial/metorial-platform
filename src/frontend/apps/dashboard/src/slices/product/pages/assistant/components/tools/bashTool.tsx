import type { AssistantLiveStateItem } from '@metorial/state';
import { Error } from '@metorial/ui';
import {
  extractCommandSummary,
  getStatusLabel,
  JsonBlock,
  normalizeCommandForDisplay,
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

type BashItem = Extract<AssistantLiveStateItem, { type: 'shell' }>;

export let BashToolCard = (p: { item: BashItem }) => {
  let item = p.item;
  let command = normalizeCommandForDisplay(item.command);
  let summary = extractCommandSummary(item.command) || command || 'command';

  return (
    <ToolSurfaceCard>
      <ToolHeader>
        <ToolHeaderMain>
          <ToolTitle>Bash</ToolTitle>
          <ToolDetail>{summary}</ToolDetail>
        </ToolHeaderMain>
        <ToolStatusBadge $status={item.status}>{getStatusLabel(item.status)}</ToolStatusBadge>
      </ToolHeader>

      <ToolContentStack>
        <ToolMetaRow>
          {item.exitCode !== null && (
            <ToolMetaChip $tone={item.exitCode === 0 ? 'added' : 'danger'}>
              exit {item.exitCode}
            </ToolMetaChip>
          )}
          {!!item.stdout && <ToolMetaChip>{item.stdout.split('\n').length} output lines</ToolMetaChip>}
          {!!item.stderr && <ToolMetaChip $tone="danger">{item.stderr.split('\n').length} error lines</ToolMetaChip>}
        </ToolMetaRow>

        <ToolSection>
          <ToolSectionLabel>Command</ToolSectionLabel>
          <JsonBlock value={command} language="bash" lineNumbers={false} />
        </ToolSection>

        {!!item.stdout && (
          <ToolSection>
            <ToolSectionLabel>Output</ToolSectionLabel>
            <JsonBlock value={item.stdout} language="text" />
          </ToolSection>
        )}

        {!!item.stderr && (
          <ToolSection>
            <ToolSectionLabel>Error output</ToolSectionLabel>
            <JsonBlock value={item.stderr} language="text" />
          </ToolSection>
        )}

        {item.output !== undefined && !item.stdout && !item.stderr && (
          <ToolSection>
            <ToolSectionLabel>Result</ToolSectionLabel>
            <JsonBlock value={item.output} />
          </ToolSection>
        )}

        {item.error && <Error>{item.error.message}</Error>}
      </ToolContentStack>
    </ToolSurfaceCard>
  );
};
