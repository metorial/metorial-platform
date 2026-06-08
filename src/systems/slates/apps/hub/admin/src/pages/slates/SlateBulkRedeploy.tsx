import { renderWithPagination } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Checkbox,
  Flex,
  Group,
  Input,
  Spacer,
  Text,
  Title
} from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, SlateLogoPlaceholder } from '../../components/styled.js';
import {
  deploymentStatusColors,
  versionStatusColors
} from '../../constants/statusColors.js';
import {
  bulkRedeployLatestSlates,
  listRedeployDeployments,
  redeployLatestSlate,
  waitForRedeployDeployment,
  useSlates
} from '../../state/index.js';

type Slate = NonNullable<ReturnType<typeof useSlates>['data']>['items'][number];
type RedeployOverviewItem = {
  slateId: string;
  slateName: string;
  versionId?: string;
  queuedAt?: Date | string;
  queueStatus: 'queued' | 'failed';
  deploymentId?: string;
  deploymentStatus?: 'pending' | 'running' | 'succeeded' | 'failed';
  error?: string;
};

export let SlateBulkRedeploy = () => {
  let navigate = useNavigate();
  let [search, setSearch] = useState('');
  let [debouncedSearch, setDebouncedSearch] = useState(search);
  let [selectedSlateIds, setSelectedSlateIds] = useState<Set<string>>(new Set());
  let [bulkRedeploying, setBulkRedeploying] = useState(false);
  let [rowRedeploying, setRowRedeploying] = useState<Set<string>>(new Set());
  let [overviewItems, setOverviewItems] = useState<RedeployOverviewItem[]>([]);
  let [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timeout = window.setTimeout(() => setDebouncedSearch(search), 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  let searchQuery = debouncedSearch.trim() || undefined;
  let slates = useSlates(searchQuery);
  let selectedCount = selectedSlateIds.size;
  let slateNameById = new Map(
    (slates.data?.items ?? []).map(slate => [slate.id, slate.name || slate.identifier])
  );

  useEffect(() => {
    setSelectedSlateIds(new Set());
  }, [searchQuery]);

  let emptyState = (
    <EmptyState direction="column" align="center">
      <Title size="4" weight="strong">
        No slates found
      </Title>
      <Spacer size={8} />
      <Text size="2" color="gray600">
        {searchQuery
          ? `No slates match "${searchQuery}".`
          : 'No slates have been registered in the hub yet.'}
      </Text>
    </EmptyState>
  );

  let setSlateSelected = (slateId: string, selected: boolean) => {
    setSelectedSlateIds(current => {
      let next = new Set(current);
      if (selected) next.add(slateId);
      else next.delete(slateId);
      return next;
    });
  };

  useEffect(() => {
    let pollableItems = overviewItems.filter(
      item =>
        item.queueStatus === 'queued' &&
        item.versionId &&
        item.queuedAt &&
        (!item.deploymentId ||
          item.deploymentStatus === 'pending' ||
          item.deploymentStatus === 'running')
    );
    if (pollableItems.length === 0) return;

    let isCancelled = false;
    let poll = async () => {
      try {
        let deployments = await listRedeployDeployments(
          pollableItems.map(item => ({
            slateId: item.slateId,
            versionId: item.versionId!,
            queuedAt: item.queuedAt!
          }))
        );
        if (isCancelled) return;

        setOverviewItems(current =>
          current.map(item => {
            let deployment = deployments.find(
              d => d.slate?.id === item.slateId && d.version?.id === item.versionId
            );
            if (!deployment) return item;

            return {
              ...item,
              deploymentId: deployment.id,
              deploymentStatus: deployment.status
            };
          })
        );
      } catch (error) {
        if (!isCancelled) {
          setMessage(
            error instanceof Error ? error.message : 'Failed to poll redeploy statuses.'
          );
        }
      }
    };

    poll();
    let interval = window.setInterval(poll, 2000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [overviewItems]);

  let redeploySlate = async (slate: Slate) => {
    setMessage(null);
    let slateId = slate.id;
    setRowRedeploying(current => new Set(current).add(slateId));
    try {
      let result = await redeployLatestSlate(slateId);
      setOverviewItems(current => [
        {
          slateId,
          slateName: slate.name || slate.identifier,
          versionId: result.versionId,
          queuedAt: result.queuedAt,
          queueStatus: 'queued'
        },
        ...current.filter(item => item.slateId !== slateId)
      ]);

      let deployment = await waitForRedeployDeployment({
        slateId,
        versionId: result.versionId,
        queuedAt: result.queuedAt
      });

      if (!deployment) {
        setMessage('Redeploy queued, but the deployment page is not ready yet.');
        return;
      }

      navigate(`/slates/${slateId}/deployments/${deployment.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to redeploy slate.');
    } finally {
      setRowRedeploying(current => {
        let next = new Set(current);
        next.delete(slateId);
        return next;
      });
    }
  };

  let redeploySelected = async () => {
    let slateIds = [...selectedSlateIds];
    if (slateIds.length === 0) return;

    setMessage(null);
    setBulkRedeploying(true);
    try {
      let result = await bulkRedeployLatestSlates(slateIds);
      let failed = result.results.filter(r => r.status === 'failed');
      let queued = result.results.length - failed.length;
      setOverviewItems(
        result.results.map(result => ({
          slateId: result.slateId,
          slateName: slateNameById.get(result.slateId) ?? result.slateId,
          versionId: result.status === 'queued' ? result.versionId : undefined,
          queuedAt: result.status === 'queued' ? result.queuedAt : undefined,
          queueStatus: result.status,
          error: result.error?.message
        }))
      );
      setMessage(
        failed.length
          ? `Queued ${queued} redeploys. ${failed.length} failed.`
          : `Queued ${queued} redeploys.`
      );
      if (failed.length === 0) setSelectedSlateIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to redeploy selected slates.');
    } finally {
      setBulkRedeploying(false);
    }
  };

  return (
    <Flex direction="column" gap={32}>
      <Flex justify="space-between" align="end" gap={16} style={{ flexWrap: 'wrap' }}>
        <div>
          <Title size="6" weight="strong">
            Bulk Redeploy Slates
          </Title>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            Search slates and queue redeploys for their newest versions.
          </Text>
        </div>
        <Flex align="end" gap={12} style={{ flexWrap: 'wrap' }}>
          <div style={{ width: '100%', maxWidth: 320 }}>
            <Input
              label="Search slates"
              hideLabel
              placeholder="Search by slate name"
              value={search}
              onInput={value => setSearch(value)}
            />
          </div>
          <Button
            color="blue"
            disabled={selectedCount === 0 || bulkRedeploying}
            loading={bulkRedeploying}
            onClick={redeploySelected}
          >
            Redeploy selected{selectedCount ? ` (${selectedCount})` : ''}
          </Button>
        </Flex>
      </Flex>

      {message && (
        <Text size="2" color="gray600">
          {message}
        </Text>
      )}

      {overviewItems.length > 0 && (
        <Group.Wrapper>
          <Group.Header title="Redeploy Status" />
          <Table
            padding={{ sides: '20px' }}
            headers={['Slate', 'Version', 'Status', 'Deployment']}
            data={overviewItems.map(item => {
              let status = item.error
                ? 'failed to queue'
                : item.deploymentStatus ?? 'waiting for deployment';

              return {
                data: [
                  <Text size="2" weight="strong">
                    {item.slateName}
                  </Text>,
                  item.versionId ? (
                    <Text size="2" style={{ fontFamily: 'monospace' }}>
                      {item.versionId}
                    </Text>
                  ) : (
                    <Text size="2" color="gray600">
                      -
                    </Text>
                  ),
                  <Badge
                    color={
                      item.deploymentStatus
                        ? deploymentStatusColors[item.deploymentStatus] || 'gray'
                        : item.error
                          ? 'red'
                          : 'gray'
                    }
                  >
                    {status}
                  </Badge>,
                  item.deploymentId ? (
                    <Link
                      to={`/slates/${item.slateId}/deployments/${item.deploymentId}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Button as="span" size="2" variant="outline">
                        View deployment
                      </Button>
                    </Link>
                  ) : item.error ? (
                    <Text size="1" color="red600">
                      {item.error}
                    </Text>
                  ) : (
                    <Text size="2" color="gray600">
                      Polling...
                    </Text>
                  )
                ]
              };
            })}
          />
        </Group.Wrapper>
      )}

      {renderWithPagination(slates, { emptyState })(({ data }) => {
        let items = data.items;
        let visibleSlateIds = items.map(slate => slate.id);
        let allVisibleSelected =
          visibleSlateIds.length > 0 &&
          visibleSlateIds.every(slateId => selectedSlateIds.has(slateId));

        return (
          <Group.Wrapper>
            <Group.Content>
              <Checkbox
                label="Select all visible slates"
                checked={allVisibleSelected}
                onCheckedChange={checked => {
                  setSelectedSlateIds(current => {
                    let next = new Set(current);
                    for (let slateId of visibleSlateIds) {
                      if (checked) next.add(slateId);
                      else next.delete(slateId);
                    }
                    return next;
                  });
                }}
              />
            </Group.Content>
            <Table
              padding={{ sides: '20px' }}
              headers={[
                'Select',
                'Slate',
                'Newest Version',
                'Current Version',
                'Status',
                'Actions'
              ]}
              data={items.map((slate: Slate) => {
                let displayName = slate.name || slate.identifier;
                let latestVersion = slate.latestVersion;
                let currentVersion = slate.currentVersion;
                let isRedeploying = rowRedeploying.has(slate.id);

                return {
                  data: [
                    <Checkbox
                      label={`Select ${displayName}`}
                      hideLabel
                      checked={selectedSlateIds.has(slate.id)}
                      onCheckedChange={checked => setSlateSelected(slate.id, checked)}
                    />,
                    <Flex align="center" gap={14}>
                      <SlateLogoPlaceholder align="center" justify="center">
                        {displayName.charAt(0).toUpperCase()}
                      </SlateLogoPlaceholder>
                      <Flex direction="column">
                        <Link to={`/slates/${slate.id}`} style={{ textDecoration: 'none' }}>
                          <Text size="2" weight="strong">
                            {displayName}
                          </Text>
                        </Link>
                        <Text size="1" color="gray600">
                          {slate.slate?.fullIdentifier || slate.identifier}
                        </Text>
                      </Flex>
                    </Flex>,
                    latestVersion ? (
                      <Badge color="blue">v{latestVersion.version}</Badge>
                    ) : (
                      <Text size="2" color="gray500">
                        -
                      </Text>
                    ),
                    currentVersion ? (
                      <Badge color="green">v{currentVersion.version}</Badge>
                    ) : (
                      <Text size="2" color="gray500">
                        -
                      </Text>
                    ),
                    <Badge
                      color={
                        latestVersion?.status
                          ? versionStatusColors[latestVersion.status] || 'gray'
                          : 'gray'
                      }
                    >
                      {latestVersion?.status ?? 'no version'}
                    </Badge>,
                    <Button
                      size="2"
                      variant="outline"
                      disabled={!latestVersion || isRedeploying || bulkRedeploying}
                      loading={isRedeploying}
                      onClick={() => redeploySlate(slate)}
                    >
                      Redeploy
                    </Button>
                  ]
                };
              })}
            />
          </Group.Wrapper>
        );
      })}
    </Flex>
  );
};
