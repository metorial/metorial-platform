import { Badge, Button, Flex, RenderDate, Spacer, Text, theme } from '@metorial/ui';
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

      <Flex direction="column" gap={8}>
        {allVersions.map(version => {
          let isSelected = selectedVersionId === version.id;
          let isCurrent = version.id === currentVersionId;

          return (
            <div
              key={version.id}
              style={{
                border: `1px solid ${isSelected ? theme.colors.blue500 : theme.colors.gray300}`,
                borderRadius: 8,
                padding: '12px 14px'
              }}
            >
              <Flex
                style={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <Flex direction="column" gap={4}>
                  <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text size="2" weight="strong">
                      {version.version}
                    </Text>
                    {isCurrent && (
                      <Badge color="blue" size="1">
                        default
                      </Badge>
                    )}
                  </Flex>
                  <Text size="1" color="gray600">
                    <RenderDate date={version.createdAt} />
                  </Text>
                </Flex>

                <Button
                  size="2"
                  variant={isSelected ? 'outline' : 'solid'}
                  onClick={() => setSelectedVersionId(version.id)}
                  disabled={isSelected}
                >
                  {isSelected ? 'Selected' : 'Select version'}
                </Button>
              </Flex>
            </div>
          );
        })}
      </Flex>
    </>
  );
};
