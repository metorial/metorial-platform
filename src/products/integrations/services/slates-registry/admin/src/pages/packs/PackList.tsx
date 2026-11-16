import { renderWithLoader, renderWithPagination } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Callout,
  Flex,
  Group,
  RenderDate,
  Spacer,
  Text,
  Title
} from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState, MonoCode, MonoText } from '../../components/styled';
import { useSlatePackOverview, useSlatePackReleases } from '../../hooks';
import { BuildTable } from './BuildTable';
import { ForceFullSyncDialog } from './ForceFullSyncDialog';
import { formatBytes } from './formatBytes';

let refreshIntervalMs = 10_000;

let Stat = (p: { label: string; value: React.ReactNode }) => (
  <div>
    <Text size="1" color="gray600">
      {p.label}
    </Text>
    <Text size="4" weight="strong">
      {p.value}
    </Text>
  </div>
);

let ReleaseTable = (p: { tenantId: string; subRegistryIdentifier: string }) => {
  let [status, setStatus] = useState<'ready' | 'pruned'>('ready');
  let releases = useSlatePackReleases({
    tenantId: p.tenantId,
    subRegistryIdentifier: p.subRegistryIdentifier,
    status
  });

  return (
    <Group.Wrapper>
      <Group.Header
        title="Pack Files"
        description="Every file this channel has published, newest first."
        actions={
          <Flex gap={8}>
            {(['ready', 'pruned'] as const).map(option => (
              <Button
                key={option}
                size="1"
                variant={status === option ? 'solid' : 'soft'}
                onClick={() => {
                  setStatus(option);
                  releases.resetCursor();
                }}
              >
                {option === 'ready' ? 'Available' : 'Deleted'}
              </Button>
            ))}
          </Flex>
        }
      />
      {renderWithPagination(releases, {
        emptyState: (
          <EmptyState direction="column" align="center">
            <Text size="2" color="gray600">
              {status === 'ready' ? 'No packs have been built yet.' : 'No packs were deleted.'}
            </Text>
          </EmptyState>
        )
      })(({ data }) => (
        <Table
          padding={{ sides: '20px' }}
          headers={['File', 'Type', 'Versions', 'Size', 'Created']}
          data={data.items.map(release => ({
            data: [
              <div>
                <Text size="2" weight="medium">
                  <MonoText>{release.fileName}</MonoText>
                </Text>
                <Text size="1" color="gray600">
                  <MonoText>sha256:{release.sha256.slice(0, 16)}…</MonoText>
                </Text>
              </div>,
              release.kind === 'full' ? (
                <Badge color="purple" size="2">
                  Full sync · part {release.part} of {release.partCount}
                </Badge>
              ) : (
                <Badge color="gray" size="2">
                  Pack #{release.sequence}
                </Badge>
              ),
              release.entryCount.toLocaleString(),
              formatBytes(release.size),
              <RenderDate date={release.createdAt} />
            ]
          }))}
        />
      ))}
    </Group.Wrapper>
  );
};

export let PackList = () => {
  let { tenantId } = useParams<{ tenantId: string }>();
  let overview = useSlatePackOverview(tenantId);

  useEffect(() => {
    let interval = setInterval(() => overview.refetch(), refreshIntervalMs);
    return () => clearInterval(interval);
  }, [overview.refetch]);

  return renderWithLoader({ overview })(({ overview }) => {
    let { channels, canBuildPacks, versionsWithoutChecksum } = overview.data!;

    return (
      <Flex direction="column" gap={24}>
        <div>
          <Title size="6" weight="strong">
            Slate Packs
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            Signed packs of slates that installations without internet access import. Each
            sub-registry channel publishes incremental packs as slates change, and a full sync
            every week.
          </Text>
        </div>

        {!canBuildPacks && (
          <Callout color="orange">
            <Text size="2">
              This registry does not build packs. It needs to run in root mode with signing
              enabled.
            </Text>
          </Callout>
        )}

        {versionsWithoutChecksum > 0 && (
          <Callout color="orange">
            <Text size="2">
              {versionsWithoutChecksum.toLocaleString()} versions have no content checksum yet,
              so they are left out of packs. A background job is filling them in; once it
              finishes, rebuild the incremental history to pack them.
            </Text>
          </Callout>
        )}

        {!channels.length && (
          <EmptyState direction="column" align="center">
            <Title size="4" weight="strong">
              No pack channels
            </Title>
            <Spacer size={8} />
            <Text size="2" color="gray600">
              Add a sub-registry identifier to SLATES_PACK_CHANNELS to publish packs for it.
            </Text>
          </EmptyState>
        )}

        {channels.map(channel => (
          <Flex direction="column" gap={16} key={channel.subRegistry.id}>
            <Group.Wrapper>
              <Group.Header
                title={channel.subRegistry.name}
                description={
                  <Badge color="gray" size="2">
                    <code>{channel.subRegistry.identifier}</code>
                  </Badge>
                }
                actions={
                  tenantId && (
                    <ForceFullSyncDialog
                      tenantId={tenantId}
                      subRegistry={channel.subRegistry}
                      disabled={!canBuildPacks}
                    />
                  )
                }
              />
              <Group.Content>
                <Flex direction="column" gap={20}>
                  <Flex gap={48} wrap="wrap">
                    <Stat label="Latest pack" value={`#${channel.lastSequence}`} />
                    <Stat label="Full syncs" value={channel.readyFullCount} />
                    <Stat label="Incremental packs" value={channel.readyIncrementalCount} />
                    <Stat label="Stored" value={formatBytes(channel.readySize)} />
                    <Stat label="Deleted" value={channel.prunedCount} />
                  </Flex>

                  <Flex gap={48} wrap="wrap">
                    <div>
                      <Text size="1" color="gray600">
                        Last full sync
                      </Text>
                      <Text size="2">
                        {channel.lastFullSyncAt ? (
                          <RenderDate date={channel.lastFullSyncAt} />
                        ) : (
                          'Never'
                        )}
                      </Text>
                    </div>
                    <div>
                      <Text size="1" color="gray600">
                        Last incremental pack
                      </Text>
                      <Text size="2">
                        {channel.lastIncrementalAt ? (
                          <RenderDate date={channel.lastIncrementalAt} />
                        ) : (
                          'Never'
                        )}
                      </Text>
                    </div>
                  </Flex>

                  {channel.isBuilding && (
                    <Callout color="blue">
                      <Text size="2">
                        A build is running. Open it in the Builds table to follow its log.
                      </Text>
                    </Callout>
                  )}

                  {channel.lastBuildError && (
                    <Callout color="red">
                      <Text size="2">
                        The last build failed
                        {channel.lastBuildErrorAt && (
                          <>
                            {' '}
                            (<RenderDate date={channel.lastBuildErrorAt} />)
                          </>
                        )}
                        : <MonoCode>{channel.lastBuildError}</MonoCode>
                      </Text>
                    </Callout>
                  )}
                </Flex>
              </Group.Content>
            </Group.Wrapper>

            {tenantId && (
              <BuildTable
                tenantId={tenantId}
                subRegistryIdentifier={channel.subRegistry.identifier}
              />
            )}

            {tenantId && (
              <ReleaseTable
                tenantId={tenantId}
                subRegistryIdentifier={channel.subRegistry.identifier}
              />
            )}
          </Flex>
        ))}
      </Flex>
    );
  });
};
