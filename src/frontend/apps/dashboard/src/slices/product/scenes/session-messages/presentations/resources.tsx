import { RiFileTextLine } from '@remixicon/react';
import { CatalogOverview } from '../components/catalogOverview';
import type { EntityDetail, OverviewSection } from '../types';
import { getMethodResult } from '../utils';

export let getResourcesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let resources = Array.isArray(result?.resources) ? result.resources : [];
  let visibleResources = resources.slice(0, 6).map((resource: any, index: number) => ({
    description: resource.description ? String(resource.description) : undefined,
    details: [
      resource.name && resource.title && resource.name !== resource.title
        ? { label: 'Name', value: String(resource.name) }
        : null,
      resource.uri ? { label: 'URI', value: String(resource.uri) } : null,
      resource.mimeType ? { label: 'MIME Type', value: String(resource.mimeType) } : null
    ].filter(Boolean) as EntityDetail[],
    id: String(resource.uri ?? resource.name ?? index),
    title: String(resource.title ?? resource.name ?? resource.uri ?? `Resource ${index + 1}`)
  }));

  return [
    {
      id: 'resources',
      content: (
        <CatalogOverview
          emptyText="No resources were returned."
          icon={<RiFileTextLine />}
          items={visibleResources}
          moreText={
            result?.nextCursor
              ? 'More resources are available through pagination.'
              : resources.length > visibleResources.length
                ? `Showing the first ${visibleResources.length} of ${resources.length} resources.`
                : null
          }
        />
      )
    }
  ];
};
