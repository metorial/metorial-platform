import { Badge, Button, Entity, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useProviderVersionContext } from './_layout';

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
            <Entity.Wrapper>
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

                <Entity.Field title="Actions" right>
                  <Button
                    size="2"
                    variant={isSelected ? 'outline' : 'solid'}
                    onClick={() => setSelectedVersionId(version.id)}
                    disabled={isSelected}
                  >
                    {isSelected ? 'Selected' : 'Select version'}
                  </Button>
                </Entity.Field>
              </Entity.Content>
            </Entity.Wrapper>
          );
        })}
      </Flex>
    </>
  );
};
