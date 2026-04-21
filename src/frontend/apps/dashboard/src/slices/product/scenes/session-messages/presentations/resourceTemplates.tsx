import { RiFolderLine } from '@remixicon/react';
import { CatalogOverview } from '../components/catalogOverview';
import type { EntityDetail, OverviewSection } from '../types';
import { getMethodResult } from '../utils';

export let getResourceTemplatesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let templates = Array.isArray(result?.resourceTemplates) ? result.resourceTemplates : [];
  let visibleTemplates = templates.slice(0, 6).map((template: any, index: number) => ({
    description: template.description ? String(template.description) : undefined,
    details: [
      template.uriTemplate
        ? { label: 'URI Template', value: String(template.uriTemplate) }
        : null,
      template.mimeType ? { label: 'MIME Type', value: String(template.mimeType) } : null
    ].filter(Boolean) as EntityDetail[],
    id: String(template.uriTemplate ?? template.name ?? index),
    title: String(
      template.title ?? template.name ?? template.uriTemplate ?? `Template ${index + 1}`
    )
  }));

  return [
    {
      id: 'resource-templates',
      content: (
        <CatalogOverview
          emptyText="No resource templates were returned."
          icon={<RiFolderLine />}
          items={visibleTemplates}
          moreText={
            templates.length > visibleTemplates.length
              ? `Showing the first ${visibleTemplates.length} of ${templates.length} templates.`
              : null
          }
        />
      )
    }
  ];
};
