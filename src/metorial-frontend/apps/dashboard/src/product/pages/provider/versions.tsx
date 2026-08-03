import { Badge, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useProviderVersionContext } from './providerVersionContext';

export let ProviderVersionsPage = () => {
  let { selectedVersionId, setSelectedVersionId, currentVersionId, allVersions } =
    useProviderVersionContext();

  let hasVersions = allVersions.length > 0;

  if (!hasVersions) {
    return (
      <>
        <Spacer size={10} />
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No versions found for this provider.
        </Text>
      </>
    );
  }

  return (
    <>
      <Spacer size={10} />

      <Flex direction="column" gap={10}>
        {allVersions.map(version => {
          let isSelected = selectedVersionId === version.id;
          let isCurrent = version.id === currentVersionId;

          return (
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

                <Entity.Field
                  title="Release date"
                  value={<RenderDate date={version.createdAt} />}
                />

                <Entity.Field title="ID" value={<ID id={version.id} />} />
              </Entity.Content>
            </Entity.Wrapper>
          );
        })}
      </Flex>
    </>
  );
};
