import { Button, Flex, Text } from '@metorial/ui';
import { CatalogTable } from '../components/catalogTable';
import { showCapabilityDetailsPanel } from '../components/capabilityDetailsPanel';
import type { OverviewSection } from '../types';
import { getMethodResult } from '../utils';

export let getResourceTemplatesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let templates = Array.isArray(result?.resourceTemplates) ? result.resourceTemplates : [];
  let visibleTemplates = templates.slice(0, 6);

  let emptyCell = (
    <Text size="2" color="gray500">
      —
    </Text>
  );

  let rows = visibleTemplates.map((template: any, index: number) => {
    let title = String(
      template?.title ?? template?.name ?? template?.uriTemplate ?? `Template ${index + 1}`
    );
    let name = template?.name ? String(template.name) : null;
    let uriTemplate = template?.uriTemplate ? String(template.uriTemplate) : null;
    let mimeType = template?.mimeType ? String(template.mimeType) : null;

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
      uriTemplate ? (
        <Text size="2" style={{ fontFamily: 'monospace' }} color="gray700">
          {uriTemplate}
        </Text>
      ) : (
        emptyCell
      ),
      mimeType ? (
        <Text size="2" color="gray700">
          {mimeType}
        </Text>
      ) : (
        emptyCell
      ),
      <Flex justify="end" style={{ width: '100%' }}>
        <Button
          size="1"
          variant="outline"
          onClick={() =>
            showCapabilityDetailsPanel({ kind: 'resourceTemplate', entity: template })
          }
        >
          View Details
        </Button>
      </Flex>
    ];
  });

  return [
    {
      id: 'resource-templates',
      content: (
        <CatalogTable
          emptyText="No resource templates were returned."
          headers={['Name', 'URI Template', 'MIME Type', '']}
          rows={rows}
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
