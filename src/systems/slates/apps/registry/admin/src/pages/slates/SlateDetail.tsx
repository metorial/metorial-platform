import { useNavigate, useParams } from 'react-router-dom';
import { renderWithLoader } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Flex,
  Group,
  Text,
  CenteredSpinner,
  RenderDate,
  Datalist
} from '@metorial-io/ui';
import { useSlate, useSlateVersions } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { MonoCode, SlateLogoImage, SlateLogoPlaceholder } from '../../components/styled';
import { styled } from 'styled-components';

let LargeLogo = styled(SlateLogoImage)`
  width: 72px;
  height: 72px;
  border-radius: 12px;
`;

let LargeLogoPlaceholder = styled(SlateLogoPlaceholder)`
  width: 72px;
  height: 72px;
  border-radius: 12px;
  font-size: 24px;
`;

let VersionItem = styled(Flex)<{ $current?: boolean }>`
  padding: 16px;
  background: ${p => (p.$current ? '#f0fdf4' : '#f8fafc')};
  border: 1px solid ${p => (p.$current ? '#bbf7d0' : '#e2e8f0')};
  border-radius: 8px;
`;

export let SlateDetail = () => {
  let { tenantId, slateId } = useParams<{ tenantId: string; slateId: string }>();
  let navigate = useNavigate();
  let slate = useSlate(tenantId, slateId!);
  let versions = useSlateVersions(tenantId, slateId!);

  return renderWithLoader({ slate })(({ slate }) => {
    let slateData = slate.data!;
    let versionItems = versions.data?.items ?? [];

    return (
      <Flex direction="column" gap={24}>
        <BackLink to={`/tenants/${tenantId}/slates`}>Back to Slates</BackLink>

        <Group.Wrapper>
          <Group.Content>
            <Flex gap={20} align="start">
              {slateData.logoUrl ? (
                <LargeLogo src={slateData.logoUrl} alt="" />
              ) : (
                <LargeLogoPlaceholder align="center" justify="center">
                  S
                </LargeLogoPlaceholder>
              )}
              <Flex direction="column" style={{ flex: 1 }}>
                <Flex justify="space-between" align="start" style={{ marginBottom: 8 }}>
                  <Text size="5" weight="bold">
                    {slateData.name}
                  </Text>
                  <Button
                    onClick={() =>
                      navigate(`/tenants/${tenantId}/slates/${slateData.id}/publish`)
                    }
                  >
                    Publish New Version
                  </Button>
                </Flex>
                <MonoCode style={{ marginBottom: 12 }}>{slateData.fullIdentifier}</MonoCode>
                {slateData.description && (
                  <Text size="2" color="gray600">
                    {slateData.description}
                  </Text>
                )}
              </Flex>
            </Flex>
          </Group.Content>

          <Group.Content>
            <Flex gap={8} wrap="wrap" style={{ marginBottom: 20 }}>
              <Badge color={slateData.access === 'public' ? 'green' : 'gray'} size="1">
                {slateData.access}
              </Badge>
              <Badge color={slateData.status === 'active' ? 'green' : 'gray'} size="1">
                {slateData.status}
              </Badge>
              <Badge
                color={slateData.scope?.type === 'workspace' ? 'purple' : 'blue'}
                size="1"
              >
                {slateData.scope?.type}: {slateData.scope?.name}
              </Badge>
            </Flex>

            <Datalist
              items={[
                { label: 'ID', value: <MonoCode>{slateData.id}</MonoCode> },
                { label: 'Current Version', value: slateData.currentVersion?.version ?? 'No version' },
                { label: 'Created By', value: slateData.createdByUser?.name ?? 'Unknown' },
                { label: 'Created', value: <RenderDate date={slateData.createdAt} /> }
              ]}
            />

            {slateData.skills && slateData.skills.length > 0 && (
              <Flex
                direction="column"
                gap={10}
                style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}
              >
                <Text size="2" color="gray600">
                  Skills
                </Text>
                <Flex gap={8} wrap="wrap">
                  {slateData.skills.map(skill => (
                    <Badge key={skill} color="blue" size="1">
                      {skill}
                    </Badge>
                  ))}
                </Flex>
              </Flex>
            )}
          </Group.Content>
        </Group.Wrapper>

        <Group.Wrapper>
          <Group.Header title="Versions" />
          <Group.Content>
            {versions.isLoading && !versions.data ? (
              <CenteredSpinner />
            ) : versionItems.length === 0 ? (
              <Text size="2" color="gray600">
                No versions published yet.
              </Text>
            ) : (
              <Flex direction="column" gap={12}>
                {versionItems.map(version => (
                  <VersionItem
                    key={version.id}
                    $current={version.isCurrent}
                    align="center"
                    justify="space-between"
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
                    </Flex>
                    <Flex align="center" gap={4}>
                      <RenderDate date={version.createdAt} />
                      {version.createdByUser && <Text size="2" color="gray600">by {version.createdByUser.name}</Text>}
                    </Flex>
                  </VersionItem>
                ))}
                {(versions.data?.pagination.hasMoreBefore ||
                  versions.data?.pagination.hasMoreAfter) && (
                  <Flex justify="end" gap={10}>
                    <Button
                      variant="outline"
                      size="2"
                      disabled={!versions.data?.pagination.hasMoreBefore || versions.isLoading}
                      onClick={() => versions.previous()}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="2"
                      disabled={!versions.data?.pagination.hasMoreAfter || versions.isLoading}
                      onClick={() => versions.next()}
                    >
                      Next
                    </Button>
                  </Flex>
                )}
              </Flex>
            )}
          </Group.Content>
        </Group.Wrapper>
      </Flex>
    );
  });
};
