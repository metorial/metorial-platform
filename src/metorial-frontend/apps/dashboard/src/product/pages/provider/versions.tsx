import { renderWithPagination } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCurrentInstance, useProvider, useProviderVersions } from '@metorial/state';
import { Badge, Entity, Flex, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import type { ProviderVersion } from './providerVersionContext';

let VersionRow = ({
  version,
  isCurrent
}: {
  version: ProviderVersion;
  isCurrent: boolean;
}) => (
  <Entity.Wrapper aligned>
    <Entity.Content>
      <Entity.Field
        prefix={
          isCurrent && (
            <Badge color="blue" size="1">
              Default
            </Badge>
          )
        }
        title={version.version}
      />

      <Entity.Field title="Release date" value={<RenderDate date={version.createdAt} />} />

      <Entity.Field title="ID" value={<ID id={version.id} />} />
    </Entity.Content>
  </Entity.Wrapper>
);

export let ProviderVersionsPage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);
  let versions = useProviderVersions(instance.data?.id, provider.data?.id, { order: 'desc' });

  let currentVersion = provider.data?.currentVersion ?? null;

  return (
    <DetailsTableLayout
      title="Versions"
      description="Every published version of this provider."
    >
      {renderWithPagination(versions, {
        emptyState: (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No versions found for this provider.
          </Text>
        )
      })(versions => {
        let isFirstPage = !versions.data.pagination.hasMoreBefore;
        let otherVersions = versions.data.items.filter(v => v.id !== currentVersion?.id);

        return (
          <Flex direction="column" gap={10}>
            {isFirstPage && currentVersion && (
              <VersionRow key={currentVersion.id} version={currentVersion} isCurrent />
            )}

            {otherVersions.map(version => (
              <VersionRow key={version.id} version={version} isCurrent={false} />
            ))}
          </Flex>
        );
      })}
    </DetailsTableLayout>
  );
};
