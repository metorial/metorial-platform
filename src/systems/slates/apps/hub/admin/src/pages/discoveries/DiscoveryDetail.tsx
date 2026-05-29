import { renderWithLoader } from '@metorial/data-hooks';
import {
  Badge,
  Datalist,
  Flex,
  Group,
  InlineCopy,
  RenderDate,
  Text
} from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { discoveryStatusColors } from '../../constants/statusColors.js';
import {
  useDiscoveryBuildOutput,
  useDiscoverySpecification,
  useDiscoveryToolCallStats,
  useSlateDiscovery
} from '../../state/index.js';
import { BackLink } from '../../components/BackLink.js';
import { LogViewer, MonoCode, TextLink } from '../../components/styled.js';
import { SpecificationViewer } from '../../components/SpecificationViewer.js';

type BuildOutputData = NonNullable<ReturnType<typeof useDiscoveryBuildOutput>['data']>;

let formatBuildOutput = (buildOutput: BuildOutputData): string => {
  let logs = buildOutput.logs;
  if (Array.isArray(logs)) {
    return logs.map(entry => entry.message).join('\n');
  }

  return JSON.stringify(buildOutput, null, 2);
};

export let DiscoveryDetail = () => {
  let { slateId, versionId, discoveryId } = useParams<{
    slateId: string;
    versionId: string;
    discoveryId: string;
  }>();

  let discovery = useSlateDiscovery(slateId, versionId, discoveryId);
  let buildOutput = useDiscoveryBuildOutput(slateId, versionId, discoveryId);
  let specification = useDiscoverySpecification(slateId, versionId, discoveryId);
  let toolCallStats = useDiscoveryToolCallStats(slateId, versionId, discoveryId);

  return renderWithLoader({ discovery })(({ discovery }) => {
    let discoveryData = discovery.data!;
    let specificationData = specification.data;
    let buildOutputData = buildOutput.data;

    return (
      <Flex direction="column" gap={24}>
        <BackLink to="/discoveries">Back to Discoveries</BackLink>

        <Group.Wrapper>
          <Group.Header title="Discovery Details" />
          <Group.Content>
            <Datalist
              items={[
                {
                  label: 'Discovery ID',
                  value: (
                    <Flex align="center" gap={6}>
                      <MonoCode>{discoveryData.id}</MonoCode>
                      <InlineCopy value={discoveryData.id} />
                    </Flex>
                  )
                },
                {
                  label: 'Slate',
                  value: (
                    <TextLink to={`/slates/${discoveryData.slate?.id}`}>
                      {discoveryData.slate?.name ?? discoveryData.slate?.identifier ?? '-'}
                    </TextLink>
                  )
                },
                {
                  label: 'Status',
                  value: (
                    <Badge color={discoveryStatusColors[discoveryData.status] || 'gray'} size="1">
                      {discoveryData.status}
                    </Badge>
                  )
                },
                {
                  label: 'Version',
                  value: (
                    <Badge color="blue" size="1">
                      v{discoveryData.version?.version ?? '-'}
                    </Badge>
                  )
                },
                { label: 'Created', value: <RenderDate date={discoveryData.createdAt} /> }
              ]}
            />
          </Group.Content>
        </Group.Wrapper>

        {discoveryData.error && (
          <Group.Wrapper>
            <Group.Header title="Error" />
            <Group.Content>
              <Flex
                direction="column"
                gap={12}
                style={{
                  padding: 16,
                  background: '#fef2f2',
                  borderRadius: 8,
                  border: '1px solid #fecaca'
                }}
              >
                <Flex align="center" gap={8}>
                  <Badge color="red">{discoveryData.error.code}</Badge>
                </Flex>
                <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                  {discoveryData.error.message}
                </Text>
              </Flex>
            </Group.Content>
          </Group.Wrapper>
        )}

        {specificationData && (
          <SpecificationViewer specification={specificationData} toolCallStats={toolCallStats.data} />
        )}

        <Group.Wrapper>
          <Group.Header title="Discovery Logs" />
          <Group.Content>
            {buildOutputData ? (
              <LogViewer>{formatBuildOutput(buildOutputData)}</LogViewer>
            ) : (
              <Text size="2" color="gray600">
                No logs available.
              </Text>
            )}
          </Group.Content>
        </Group.Wrapper>
      </Flex>
    );
  });
};
