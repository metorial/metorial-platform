import { Button, Flex, Text } from '@metorial/ui';
import { CatalogTable } from '../components/catalogTable';
import { showCapabilityDetailsPanel } from '../components/capabilityDetailsPanel';
import type { OverviewSection } from '../types';
import { getMethodResult } from '../utils';

export let getResourcesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let resources = Array.isArray(result?.resources) ? result.resources : [];
  let visibleResources = resources.slice(0, 6);

  let emptyCell = (
    <Text size="2" color="gray500">
      —
    </Text>
  );

  let rows = visibleResources.map((resource: any, index: number) => {
    let title = String(
      resource?.title ?? resource?.name ?? resource?.uri ?? `Resource ${index + 1}`
    );
    let name = resource?.name ? String(resource.name) : null;
    let uri = resource?.uri ? String(resource.uri) : null;
    let mimeType = resource?.mimeType ? String(resource.mimeType) : null;

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
      uri ? (
        <Text size="2" style={{ fontFamily: 'monospace' }} color="gray700">
          {uri}
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
          onClick={() => showCapabilityDetailsPanel({ kind: 'resource', entity: resource })}
        >
          View Details
        </Button>
      </Flex>
    ];
  });

  return [
    {
      id: 'resources',
      content: (
        <CatalogTable
          emptyText="No resources were returned."
          headers={['Name', 'URI', 'MIME Type', '']}
          rows={rows}
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
