import { RiChatQuoteLine } from '@remixicon/react';
import { CatalogOverview } from '../components/catalogOverview';
import type { EntityDetail, OverviewSection } from '../types';
import { getMethodResult, pluralize } from '../utils';

export let getPromptsOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let prompts = Array.isArray(result?.prompts) ? result.prompts : [];
  let visiblePrompts = prompts.slice(0, 6).map((prompt: any, index: number) => {
    let argumentCount = Array.isArray(prompt.arguments) ? prompt.arguments.length : 0;

    return {
      description: prompt.description ? String(prompt.description) : undefined,
      details: [
        prompt.name ? { label: 'Name', value: String(prompt.name) } : null,
        {
          label: 'Arguments',
          value: argumentCount > 0 ? pluralize(argumentCount, 'argument') : 'No arguments'
        }
      ].filter(Boolean) as EntityDetail[],
      id: String(prompt.name ?? index),
      title: String(prompt.title ?? prompt.name ?? `Prompt ${index + 1}`)
    };
  });

  return [
    {
      id: 'prompts',
      content: (
        <CatalogOverview
          emptyText="No prompts were returned."
          icon={<RiChatQuoteLine />}
          items={visiblePrompts}
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
