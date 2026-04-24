import { Button, Flex, Text } from '@metorial/ui';
import { CatalogTable } from '../components/catalogTable';
import { showCapabilityDetailsPanel } from '../components/capabilityDetailsPanel';
import type { OverviewSection } from '../types';
import { getMethodResult, pluralize } from '../utils';

export let getPromptsOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let prompts = Array.isArray(result?.prompts) ? result.prompts : [];
  let visiblePrompts = prompts.slice(0, 6);

  let rows = visiblePrompts.map((prompt: any, index: number) => {
    let title = String(prompt?.title ?? prompt?.name ?? `Prompt ${index + 1}`);
    let name = prompt?.name ? String(prompt.name) : null;
    let argumentCount = Array.isArray(prompt?.arguments) ? prompt.arguments.length : 0;

    return [
      <div>
        <Text size="2" weight="strong">
          {title}
        </Text>
        {name && name !== title ? (
          <Text size="1" style={{ fontFamily: 'monospace' }} color="gray600">
            {name}
          </Text>
        ) : null}
      </div>,
      <Text size="2" color="gray700">
        {argumentCount > 0 ? pluralize(argumentCount, 'argument') : 'No arguments'}
      </Text>,
      <Flex justify="end" style={{ width: '100%' }}>
        <Button
          size="1"
          variant="outline"
          onClick={() => showCapabilityDetailsPanel({ kind: 'prompt', entity: prompt })}
        >
          View Details
        </Button>
      </Flex>
    ];
  });

  return [
    {
      id: 'prompts',
      content: (
        <CatalogTable
          emptyText="No prompts were returned."
          headers={['Name', 'Arguments', '']}
          rows={rows}
          moreText={
            result?.nextCursor
              ? 'More prompts are available through pagination.'
              : prompts.length > visiblePrompts.length
                ? `Showing the first ${visiblePrompts.length} of ${prompts.length} prompts.`
                : null
          }
        />
      )
    }
  ];
};
