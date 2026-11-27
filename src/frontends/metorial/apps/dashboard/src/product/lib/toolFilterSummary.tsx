import { useProvider, useProviderSpecification } from '@metorial/state';
import { summarizeToolFilter, toolFilterHasCategories } from '@metorial/tool-selection';
import { Text } from '@metorial/ui';
import { useMemo } from 'react';

/**
 * Tool filter summary for list rows. Category names are only fetched when the filter
 * references tool categories, so rows without categories cost no extra requests.
 */
export let ToolFilterSummaryText = (p: {
  instanceId: string;
  providerId?: string | null;
  toolFilter: unknown;
}) => {
  let hasCategories = toolFilterHasCategories(p.toolFilter);
  let provider = useProvider(p.instanceId, hasCategories ? p.providerId : null);
  let specification = useProviderSpecification(
    p.instanceId,
    hasCategories ? provider.data?.currentVersion?.specificationId : null
  );

  let categoryNames = useMemo(
    () =>
      Object.fromEntries(
        (specification.data?.toolCategories ?? []).map(category => [
          category.key,
          category.name
        ])
      ),
    [specification.data]
  );

  return <Text size="2">{summarizeToolFilter(p.toolFilter, { categoryNames })}</Text>;
};
