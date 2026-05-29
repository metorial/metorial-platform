import { renderWithLoader } from '@metorial/data-hooks';
import { Badge, Datalist, Flex, Group, InlineCopy, RenderDate, Text } from '@metorial/ui';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import {
  deploymentStatusColors,
  discoveryStatusColors,
  eventTypeColors,
  versionStatusColors
} from '../../constants/statusColors.js';
import {
  useSlate,
  useSlateDeployments,
  useSlateDiscoveries,
  useSlateEvents,
  useSlateStats,
  useSlateVersions
} from '../../state/index.js';
import { BackLink } from '../../components/BackLink.js';
import { MonoCode, SlateLogoPlaceholder } from '../../components/styled.js';

type SlateVersion = NonNullable<ReturnType<typeof useSlateVersions>['data']>['items'][number];
type SlateDeployment = NonNullable<
  ReturnType<typeof useSlateDeployments>['data']
>['items'][number];
type SlateDiscovery = NonNullable<
  ReturnType<typeof useSlateDiscoveries>['data']
>['items'][number];
type SlateEvent = NonNullable<ReturnType<typeof useSlateEvents>['data']>['items'][number];

let LargeLogoPlaceholder = styled(SlateLogoPlaceholder)`
  width: 72px;
  height: 72px;
  border-radius: 12px;
  font-size: 24px;
`;

let VersionItem = styled(Link)<{ $current?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: ${p => (p.$current ? '#f0fdf4' : '#f8fafc')};
  border: 1px solid ${p => (p.$current ? '#bbf7d0' : '#e2e8f0')};
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;

  &:hover {
    border-color: ${p => (p.$current ? '#86efac' : '#cbd5e1')};
  }
`;

let ItemCard = styled(Link)`
  display: block;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;

  &:hover {
    border-color: #cbd5e1;
  }
`;

let EventItem = styled(Flex)`
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
`;

let StatCard = styled(Flex)`
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 8px;
  min-width: 120px;
`;

let SectionHeader = styled(Flex)`
  padding: 12px 20px;
  border-bottom: 1px solid #f1f5f9;
`;

let ViewAllLink = styled(Link)`
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export let SlateDetail = () => {
  let { slateId } = useParams<{ slateId: string }>();
  let slate = useSlate(slateId);
  let stats = useSlateStats(slateId);
  let versions = useSlateVersions(slateId);
  let deployments = useSlateDeployments(slateId);
  let discoveries = useSlateDiscoveries(slateId);
  let events = useSlateEvents(slateId);

  return renderWithLoader({ slate, versions, deployments, discoveries, events } as any)(
    ({ slate, versions, deployments, discoveries, events }: any) => {
      let slateData = slate.data!;
      let statsData = stats.data;
      let versionItems = versions.data?.items ?? [];
      let deploymentItems = deployments.data?.items ?? [];
      let discoveryItems = discoveries.data?.items ?? [];
      let eventItems = events.data?.items ?? [];

      return (
        <Flex direction="column" gap={24}>
          <BackLink to="/slates">Back to Slates</BackLink>

          <Group.Wrapper>
            <Group.Content>
              <Flex gap={20} align="start">
                <LargeLogoPlaceholder align="center" justify="center">
                  S
                </LargeLogoPlaceholder>
                <Flex direction="column" style={{ flex: 1 }}>
                  <Text size="5" weight="bold" style={{ marginBottom: 8 }}>
                    {slateData.name || slateData.identifier}
                  </Text>
                  <Flex align="center" gap={6} style={{ marginBottom: 12 }}>
                    <MonoCode>
                      {slateData.slate?.fullIdentifier || slateData.identifier}
                    </MonoCode>
                    <InlineCopy
                      value={slateData.slate?.fullIdentifier || slateData.identifier}
                    />
                  </Flex>
                  {slateData.description && (
                    <Text size="2" color="gray600">
                      {slateData.description}
                    </Text>
                  )}
                </Flex>
              </Flex>
            </Group.Content>

            <Group.Content>
              <Flex gap={16} wrap="wrap">
                <StatCard direction="column" gap={4}>
                  <Text size="1" color="gray600">
                    Versions
                  </Text>
                  <Text size="4" weight="strong">
                    {statsData?.versions ?? '-'}
                  </Text>
                </StatCard>
                <StatCard direction="column" gap={4}>
                  <Text size="1" color="gray600">
                    Deployments
                  </Text>
                  <Text size="4" weight="strong">
                    {statsData?.deployments ?? '-'}
                  </Text>
                </StatCard>
                <StatCard direction="column" gap={4}>
                  <Text size="1" color="gray600">
                    Discoveries
                  </Text>
                  <Text size="4" weight="strong">
                    {statsData?.discoveries ?? '-'}
                  </Text>
                </StatCard>
                <StatCard direction="column" gap={4}>
                  <Text size="1" color="gray600">
                    Events
                  </Text>
                  <Text size="4" weight="strong">
                    {statsData?.events ?? '-'}
                  </Text>
                </StatCard>
              </Flex>
            </Group.Content>

            <Group.Content>
              <Datalist
                items={[
                  {
                    label: 'ID',
                    value: (
                      <Flex align="center" gap={6}>
                        <MonoCode>{slateData.id}</MonoCode>
                        <InlineCopy value={slateData.id} />
                      </Flex>
                    )
                  },
                  {
                    label: 'Current Version',
                    value: slateData.currentVersion ? (
                      <Flex align="center" gap={8}>
                        <Text size="2" weight="medium">
                          v{slateData.currentVersion.version}
                        </Text>
                        <Badge
                          color={
                            versionStatusColors[slateData.currentVersion.status] || 'gray'
                          }
                          size="1"
                        >
                          {slateData.currentVersion.status}
                        </Badge>
                      </Flex>
                    ) : (
                      'No version'
                    )
                  },
                  { label: 'Created', value: <RenderDate date={slateData.createdAt} /> }
                ]}
              />
            </Group.Content>
          </Group.Wrapper>

          <Group.Wrapper>
            <SectionHeader align="center" justify="space-between">
              <Text size="3" weight="strong">
                Recent Versions
              </Text>
              <ViewAllLink to={`/slates/${slateId}/versions`}>View All Versions →</ViewAllLink>
            </SectionHeader>
            <Group.Content>
              {versionItems.length === 0 ? (
                <Text size="2" color="gray600">
                  No versions available.
                </Text>
              ) : (
                <Flex direction="column" gap={12}>
                  {versionItems.slice(0, 3).map((version: SlateVersion) => (
                    <VersionItem
                      key={version.id}
                      to={`/slates/${slateId}/versions/${version.id}`}
                      $current={version.isCurrent}
                    >
                      <Flex align="center" gap={12}>
                        <Text size="3" weight="bold" style={{ fontFamily: 'monospace' }}>
                          v{version.version}
                        </Text>
                        {version.isCurrent && (
                          <Badge color="green" size="1">
                            Current
                          </Badge>
                        )}
                        <Badge color={versionStatusColors[version.status] || 'gray'} size="1">
                          {version.status}
                        </Badge>
                      </Flex>
                      <RenderDate date={version.createdAt} />
                    </VersionItem>
                  ))}
                </Flex>
              )}
            </Group.Content>
          </Group.Wrapper>

          <Group.Wrapper>
            <SectionHeader align="center" justify="space-between">
              <Text size="3" weight="strong">
                Recent Deployments
              </Text>
              <ViewAllLink to={`/slates/${slateId}/deployments`}>
                View All Deployments →
              </ViewAllLink>
            </SectionHeader>
            <Group.Content>
              {deploymentItems.length === 0 ? (
                <Text size="2" color="gray600">
                  No deployments yet.
                </Text>
              ) : (
                <Flex direction="column" gap={12}>
                  {deploymentItems.slice(0, 3).map((deployment: SlateDeployment) => (
                    <ItemCard
                      key={deployment.id}
                      to={`/slates/${slateId}/deployments/${deployment.id}`}
                    >
                      <Flex align="center" justify="space-between">
                        <Flex align="center" gap={12}>
                          <Badge
                            color={deploymentStatusColors[deployment.status] || 'gray'}
                            size="1"
                          >
                            {deployment.status}
                          </Badge>
                          <Text size="2">v{deployment.version?.version}</Text>
                          {deployment.error && (
                            <Text size="1" color="red300">
                              {deployment.error.code}
                            </Text>
                          )}
                        </Flex>
                        <RenderDate date={deployment.createdAt} />
                      </Flex>
                    </ItemCard>
                  ))}
                </Flex>
              )}
            </Group.Content>
          </Group.Wrapper>

          <Group.Wrapper>
            <SectionHeader align="center" justify="space-between">
              <Text size="3" weight="strong">
                Recent Discoveries
              </Text>
              <ViewAllLink to={`/slates/${slateId}/discoveries`}>
                View All Discoveries →
              </ViewAllLink>
            </SectionHeader>
            <Group.Content>
              {discoveryItems.length === 0 ? (
                <Text size="2" color="gray600">
                  No discoveries yet.
                </Text>
              ) : (
                <Flex direction="column" gap={12}>
                  {discoveryItems.slice(0, 3).map((discovery: SlateDiscovery) => (
                    <ItemCard
                      key={discovery.id}
                      to={`/slates/${slateId}/versions/${discovery.version?.id}/discoveries/${discovery.id}`}
                    >
                      <Flex align="center" justify="space-between">
                        <Flex align="center" gap={12}>
                          <Badge
                            color={discoveryStatusColors[discovery.status] || 'gray'}
                            size="1"
                          >
                            {discovery.status}
                          </Badge>
                          <Text size="2">v{discovery.version?.version}</Text>
                          {discovery.error && (
                            <Text size="1" color="red300">
                              {discovery.error.code}
                            </Text>
                          )}
                        </Flex>
                        <RenderDate date={discovery.createdAt} />
                      </Flex>
                    </ItemCard>
                  ))}
                </Flex>
              )}
            </Group.Content>
          </Group.Wrapper>

          <Group.Wrapper>
            <SectionHeader align="center" justify="space-between">
              <Text size="3" weight="strong">
                Recent Events
              </Text>
              <ViewAllLink to={`/slates/${slateId}/events`}>View All Events →</ViewAllLink>
            </SectionHeader>
            <Group.Content>
              {eventItems.length === 0 ? (
                <Text size="2" color="gray600">
                  No events yet.
                </Text>
              ) : (
                <Flex direction="column">
                  {eventItems.slice(0, 3).map((event: SlateEvent) => (
                    <EventItem key={event.id} align="center" justify="space-between">
                      <Flex align="center" gap={12}>
                        <Badge color={eventTypeColors[event.type] || 'gray'} size="1">
                          {event.type.replace(/_/g, ' ')}
                        </Badge>
                        {event.message && (
                          <Text
                            size="2"
                            color="gray600"
                            style={{
                              maxWidth: 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {event.message}
                          </Text>
                        )}
                      </Flex>
                      <RenderDate date={event.createdAt} />
                    </EventItem>
                  ))}
                </Flex>
              )}
            </Group.Content>
          </Group.Wrapper>
        </Flex>
      );
    }
  );
};
