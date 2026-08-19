import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCreatePortalConsumerAccessQuiet,
  useDeletePortalConsumerAccess,
  usePortalConsumerGroups,
  usePortalConsumerProfiles,
  usePortals,
  useSkillMarketplace,
  useSkillMarketplaces
} from '@metorial/state';
import {
  Button,
  CenteredSpinner,
  Checkbox,
  Dialog,
  Entity,
  Flex,
  Input,
  Select,
  Spacer,
  Text,
  toast
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useSearchFilter } from '@metorial/use-search-filter';
import { useEffect, useMemo, useState } from 'react';
import PQueue from 'p-queue';
import { AuthMethodPicker } from '../../providerAuthConfigs/authMethodPicker';
import {
  ProviderCreationPanelShell,
  showProviderCreationPanel
} from '../../providerCreationPanel';
import { pluginsFromMarketplace } from './groupManagers';
import { MarketplaceManagerPanelScroll } from './panelShell';
import {
  MARKETPLACE_MANAGER_COPY,
  type MarketplaceManagerRow,
  type MarketplaceManagerSubjectMode
} from './types';

let paginationOpts = { hidePaginationWhenUnavailable: true };

let runAccessJobs = async (jobs: (() => Promise<boolean>)[]) => {
  if (!jobs.length) return true;
  let queue = new PQueue({ concurrency: 10 });
  let results = await queue.addAll(jobs);
  return results.every(Boolean);
};

let MarketplaceManagerPortalSelect = (p: {
  instanceId: string;
  value?: string;
  onChange: (portalId: string) => void;
}) => {
  let portals = usePortals(p.instanceId, { limit: 50 });

  return renderWithLoader({ portals })(({ portals }) => (
    <Select
      label="Portal"
      value={p.value}
      items={portals.data.items.map(portal => ({
        id: portal.id,
        label: portal.name
      }))}
      onChange={p.onChange}
    />
  ));
};

let MarketplacePicker = (p: {
  instanceId: string;
  selectedMarketplaceId: string;
  onSelect: (marketplaceId: string) => void;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let marketplaces = useSkillMarketplaces(p.instanceId, {
    order: 'desc',
    status: ['active'],
    search: searchQuery
  });

  return (
    <>
      <Input
        label="Search marketplaces"
        hideLabel
        placeholder="Search marketplaces..."
        value={search}
        onInput={setSearch}
      />
      {renderWithPagination(
        marketplaces,
        paginationOpts
      )(marketplaces => (
        <MarketplaceManagerPanelScroll>
          {marketplaces.data.items.map(item => (
            <div key={item.id} onClick={() => p.onSelect(item.id)}>
              <Entity.Wrapper>
                <Entity.Content>
                  <Entity.Field
                    prefix={
                      <Checkbox
                        checked={p.selectedMarketplaceId == item.id}
                        onCheckedChange={() => p.onSelect(item.id)}
                        label="Select Marketplace"
                        hideLabel
                      />
                    }
                    title={item.name}
                    value={item.description ?? undefined}
                  />
                </Entity.Content>
              </Entity.Wrapper>
              <Spacer size={10} />
            </div>
          ))}
          {marketplaces.data.items.length == 0 && (
            <Text size="2" color="gray600">
              No skill marketplaces found.
            </Text>
          )}
        </MarketplaceManagerPanelScroll>
      ))}
    </>
  );
};

let GroupPicker = (p: {
  instanceId: string;
  portalId: string;
  selectedGroupId: string;
  onSelect: (groupId: string) => void;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let groups = usePortalConsumerGroups(p.instanceId, p.portalId, {
    order: 'desc',
    status: ['active'],
    search: searchQuery,
    limit: 30
  });

  return (
    <>
      <Input
        label="Search groups"
        hideLabel
        placeholder="Search groups..."
        value={search}
        onInput={setSearch}
      />
      {renderWithPagination(
        groups,
        paginationOpts
      )(groups => (
        <MarketplaceManagerPanelScroll>
          {groups.data.items.map(group => (
            <div key={group.id} onClick={() => p.onSelect(group.id)}>
              <Entity.Wrapper>
                <Entity.Content>
                  <Entity.Field
                    prefix={
                      <Checkbox
                        checked={p.selectedGroupId == group.id}
                        onCheckedChange={() => p.onSelect(group.id)}
                        label="Select Group"
                        hideLabel
                      />
                    }
                    title={group.name}
                    value={group.description?.trim() || undefined}
                  />
                </Entity.Content>
              </Entity.Wrapper>
              <Spacer size={10} />
            </div>
          ))}
          {groups.data.items.length == 0 && (
            <Text size="2" color="gray600">
              No groups found.
            </Text>
          )}
        </MarketplaceManagerPanelScroll>
      ))}
    </>
  );
};

let AccountPicker = (p: {
  instanceId: string;
  portalId: string;
  selectedGroupId: string;
  onSelect: (groupId: string) => void;
}) => {
  let { search, setSearch, searchQuery } = useSearchFilter(500, {
    updateSearchParams: false
  });
  let profiles = usePortalConsumerProfiles(p.instanceId, p.portalId, {
    order: 'desc',
    search: searchQuery,
    limit: 30
  });

  return (
    <>
      <Input
        label="Search accounts"
        hideLabel
        placeholder="Search accounts by name or email..."
        value={search}
        onInput={setSearch}
      />
      {renderWithPagination(
        profiles,
        paginationOpts
      )(profiles => (
        <MarketplaceManagerPanelScroll>
          {profiles.data.items.map(profile => {
            let personalGroupId = (profile.groups ?? []).find(
              assignment => assignment.assignedVia == 'user'
            )?.group.id;

            return (
              <div
                key={profile.id}
                onClick={() => personalGroupId && p.onSelect(personalGroupId)}
              >
                <Entity.Wrapper>
                  <Entity.Content>
                    <Entity.Field
                      prefix={
                        <Checkbox
                          checked={p.selectedGroupId == personalGroupId}
                          disabled={!personalGroupId}
                          onCheckedChange={() =>
                            personalGroupId && p.onSelect(personalGroupId)
                          }
                          label="Select Account"
                          hideLabel
                        />
                      }
                      title={profile.name || profile.email || profile.id}
                      value={profile.name ? profile.email : undefined}
                    />
                  </Entity.Content>
                </Entity.Wrapper>
                <Spacer size={10} />
              </div>
            );
          })}
          {profiles.data.items.length == 0 && (
            <Text size="2" color="gray600">
              No accounts found.
            </Text>
          )}
        </MarketplaceManagerPanelScroll>
      ))}
    </>
  );
};

let MarketplaceManagerSelectStep = (p: {
  instanceId: string;
  subjectMode: MarketplaceManagerSubjectMode;
  showPortalSelect: boolean;
  needsWho: boolean;
  needsMarketplace: boolean;
  resolvedPortalId?: string;
  selectedGroupId: string;
  selectedMarketplaceId: string;
  onPortalChange: (portalId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectMarketplace: (marketplaceId: string) => void;
}) => (
  <Flex direction="column" gap={16}>
    {p.showPortalSelect ? (
      <MarketplaceManagerPortalSelect
        instanceId={p.instanceId}
        value={p.resolvedPortalId}
        onChange={p.onPortalChange}
      />
    ) : null}

    {p.needsMarketplace ? (
      <MarketplacePicker
        instanceId={p.instanceId}
        selectedMarketplaceId={p.selectedMarketplaceId}
        onSelect={p.onSelectMarketplace}
      />
    ) : null}

    {p.needsWho && p.resolvedPortalId && p.subjectMode == 'group' ? (
      <GroupPicker
        instanceId={p.instanceId}
        portalId={p.resolvedPortalId}
        selectedGroupId={p.selectedGroupId}
        onSelect={p.onSelectGroup}
      />
    ) : null}

    {p.needsWho && p.resolvedPortalId && p.subjectMode == 'account' ? (
      <AccountPicker
        instanceId={p.instanceId}
        portalId={p.resolvedPortalId}
        selectedGroupId={p.selectedGroupId}
        onSelect={p.onSelectGroup}
      />
    ) : null}
  </Flex>
);

let MarketplaceManagerAccessStep = (p: {
  isEdit: boolean;
  hasSelectStep: boolean;
  scope: 'entire' | 'plugins';
  onScopeChange: (scope: 'entire' | 'plugins') => void;
  plugins: { id: string; name: string }[];
  pluginsLoading: boolean;
  selectedPluginIds: string[];
  onTogglePlugin: (pluginId: string) => void;
  canSubmit: boolean;
  saving: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) => (
  <Flex direction="column" gap={16}>
    <AuthMethodPicker
      label="Access"
      value={p.scope}
      onChange={value => {
        if (value == 'entire' || value == 'plugins') p.onScopeChange(value);
      }}
      items={[
        {
          id: 'entire',
          name: 'Entire marketplace',
          description:
            'Full Marketplace Manager. Create plugins, update every plugin, and add or remove skills.'
        },
        {
          id: 'plugins',
          name: 'Specific plugins',
          description:
            'Plugin Manager. Can view the whole marketplace, but can only update the selected plugins and their skills. Cannot create or delete plugins.'
        }
      ]}
    />

    {p.scope == 'plugins' ? (
      p.pluginsLoading ? (
        <CenteredSpinner />
      ) : p.plugins.length ? (
        <Table
          headers={['Plugin']}
          data={p.plugins.map(plugin => ({
            data: [
              <Flex gap={8}>
                <div style={{ width: 24 }} onClick={event => event.stopPropagation()}>
                  <Checkbox
                    checked={p.selectedPluginIds.includes(plugin.id)}
                    onCheckedChange={() => p.onTogglePlugin(plugin.id)}
                    label={plugin.name}
                    hideLabel
                  />
                </div>
                <Text size="2">{plugin.name}</Text>
              </Flex>
            ],
            onClick: () => p.onTogglePlugin(plugin.id)
          }))}
        />
      ) : (
        <Text size="2" color="gray600">
          This marketplace has no plugins yet.
        </Text>
      )
    ) : null}

    <Dialog.Actions>
      {p.hasSelectStep ? (
        <Button type="button" variant="outline" onClick={p.onBack}>
          Back
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={p.onCancel}>
          Cancel
        </Button>
      )}
      <Button disabled={!p.canSubmit} loading={p.saving} onClick={p.onSubmit}>
        {p.isEdit ? 'Save Marketplace Manager' : 'Add as Marketplace Manager'}
      </Button>
    </Dialog.Actions>
  </Flex>
);

let MarketplaceManagerPanel = (props: {
  instanceId: string;
  skillMarketplaceId?: string;
  portalId?: string;
  consumerGroupId?: string;
  subjectMode?: MarketplaceManagerSubjectMode;
  edit?: MarketplaceManagerRow;
  close: () => void;
  setPanelWidth: (width: number) => void;
  onSuccess?: () => void;
}) => {
  let portals = usePortals(props.instanceId, { limit: 50 });
  let [step, setStep] = useState(0);
  let [portalId, setPortalId] = useState(props.edit?.portalId ?? props.portalId ?? '');
  let [selectedGroupId, setSelectedGroupId] = useState(
    props.edit?.consumerGroupId ?? props.consumerGroupId ?? ''
  );
  let [selectedMarketplaceId, setSelectedMarketplaceId] = useState(
    props.edit?.skillMarketplaceId ?? props.skillMarketplaceId ?? ''
  );
  let [scope, setScope] = useState<'entire' | 'plugins'>(
    props.edit?.scope.type == 'plugins' ? 'plugins' : 'entire'
  );
  let [selectedPluginIds, setSelectedPluginIds] = useState<string[]>(
    props.edit?.scope.type == 'plugins'
      ? props.edit.scope.plugins.map(plugin => plugin.id)
      : []
  );
  let [saving, setSaving] = useState(false);

  let subjectMode = props.subjectMode ?? (props.edit?.kind == 'account' ? 'account' : 'group');
  let resolvedPortalId = portalId || portals.data?.items[0]?.id;
  let marketplace = useSkillMarketplace(
    props.instanceId,
    selectedMarketplaceId || props.skillMarketplaceId
  );
  let createAccess = useCreatePortalConsumerAccessQuiet();
  let deleteAccess = useDeletePortalConsumerAccess();

  let plugins = useMemo(
    () => (marketplace.data ? pluginsFromMarketplace(marketplace.data) : []),
    [marketplace.data]
  );

  let portalItems = portals.data?.items ?? [];
  let showPortalSelect = !props.portalId && !props.edit && portalItems.length > 1;
  let needsWho = !props.consumerGroupId && !props.edit;
  let needsMarketplace = !props.skillMarketplaceId && !props.edit;
  let hasSelectStep = needsWho || needsMarketplace;

  useEffect(() => {
    props.setPanelWidth(hasSelectStep && step == 0 ? 720 : 660);
  }, [hasSelectStep, props.setPanelWidth, step]);

  let marketplaceId = selectedMarketplaceId || props.skillMarketplaceId;
  let canGoToAccess = !!resolvedPortalId && !!selectedGroupId && !!marketplaceId;
  let canSubmit = canGoToAccess && (scope == 'entire' || selectedPluginIds.length > 0);

  let goToAccessIfReady = (next: { groupId?: string; marketplaceId?: string }) => {
    let groupId = next.groupId ?? selectedGroupId;
    let nextMarketplaceId = next.marketplaceId ?? marketplaceId;
    if (resolvedPortalId && groupId && nextMarketplaceId) setStep(1);
  };

  let selectMarketplace = (nextMarketplaceId: string) => {
    setSelectedMarketplaceId(nextMarketplaceId);
    if (!props.edit) setSelectedPluginIds([]);
    goToAccessIfReady({ marketplaceId: nextMarketplaceId });
  };

  let selectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    goToAccessIfReady({ groupId });
  };

  let togglePlugin = (pluginId: string) =>
    setSelectedPluginIds(current =>
      current.includes(pluginId)
        ? current.filter(id => id != pluginId)
        : [...current, pluginId]
    );

  let submit = async () => {
    if (!resolvedPortalId || !selectedGroupId || !marketplaceId) return;

    let createJob =
      (access: Parameters<typeof createAccess.mutate>[0]['access']) => async () => {
        let [, error] = await createAccess.mutate({
          instanceId: props.instanceId,
          portalId: resolvedPortalId,
          consumerGroupId: selectedGroupId,
          access
        });
        return !error;
      };

    let deleteJob = (consumerAccessId: string) => async () => {
      let [, error] = await deleteAccess.mutate({
        instanceId: props.instanceId,
        portalId: resolvedPortalId,
        consumerAccessId
      });
      return !error;
    };

    setSaving(true);
    try {
      if (scope == 'entire') {
        let created = await createJob({
          type: 'skill_marketplace',
          skillMarketplaceId: marketplaceId,
          permission: 'manage'
        })();
        if (!created) return;

        let removed = await runAccessJobs(
          (props.edit?.pluginAccesses ?? []).map(pluginAccess =>
            deleteJob(pluginAccess.accessId)
          )
        );
        if (!removed) return;
      } else {
        if (props.edit?.marketplaceAccessId) {
          let deletedMarketplace = await deleteJob(props.edit.marketplaceAccessId)();
          if (!deletedMarketplace) return;
        }

        let remainingPluginIds = new Set(
          props.edit?.marketplaceAccessId
            ? []
            : (props.edit?.pluginAccesses.map(item => item.pluginId) ?? [])
        );
        let desiredPluginIds = new Set(selectedPluginIds);

        let assigned = await runAccessJobs([
          ...selectedPluginIds
            .filter(pluginId => !remainingPluginIds.has(pluginId))
            .map(pluginId =>
              createJob({
                type: 'skill_plugin',
                skillMarketplaceId: marketplaceId,
                skillPluginId: pluginId
              })
            ),
          ...(props.edit?.marketplaceAccessId ? [] : (props.edit?.pluginAccesses ?? []))
            .filter(pluginAccess => !desiredPluginIds.has(pluginAccess.pluginId))
            .map(pluginAccess => deleteJob(pluginAccess.accessId))
        ]);
        if (!assigned) return;
      }

      toast.success(props.edit ? 'Marketplace Manager updated' : 'Marketplace Manager added');
      props.onSuccess?.();
      props.close();
    } finally {
      setSaving(false);
    }
  };

  let selectStepTitle = needsMarketplace
    ? 'Select Marketplace'
    : subjectMode == 'account'
      ? 'Select Account'
      : 'Select Group';

  let steps = [
    {
      title: selectStepTitle,
      render: () => (
        <MarketplaceManagerSelectStep
          instanceId={props.instanceId}
          subjectMode={subjectMode}
          showPortalSelect={showPortalSelect}
          needsWho={needsWho}
          needsMarketplace={needsMarketplace}
          resolvedPortalId={resolvedPortalId}
          selectedGroupId={selectedGroupId}
          selectedMarketplaceId={selectedMarketplaceId}
          onPortalChange={value => {
            setPortalId(value);
            if (!props.consumerGroupId) setSelectedGroupId('');
          }}
          onSelectGroup={selectGroup}
          onSelectMarketplace={selectMarketplace}
        />
      )
    },
    {
      title: 'Access',
      render: () => (
        <MarketplaceManagerAccessStep
          isEdit={!!props.edit}
          hasSelectStep={hasSelectStep}
          scope={scope}
          onScopeChange={setScope}
          plugins={plugins}
          pluginsLoading={marketplace.isLoading}
          selectedPluginIds={selectedPluginIds}
          onTogglePlugin={togglePlugin}
          canSubmit={canSubmit}
          saving={saving}
          onBack={() => setStep(0)}
          onCancel={props.close}
          onSubmit={submit}
        />
      )
    }
  ];

  return (
    <ProviderCreationPanelShell
      title={props.edit ? 'Edit Marketplace Manager' : 'Add Marketplace Manager'}
      description={MARKETPLACE_MANAGER_COPY}
      steps={hasSelectStep ? steps : [steps[1]!]}
      currentStep={hasSelectStep ? step : 0}
      setCurrentStep={nextStep => {
        if (!hasSelectStep) return;
        if (nextStep == 0 || canGoToAccess) setStep(nextStep);
      }}
      isStepDisabled={nextStep => nextStep == 1 && !canGoToAccess}
      hideStepper={!hasSelectStep}
    />
  );
};

export let showMarketplaceManagerPanel = (props: {
  instanceId: string;
  skillMarketplaceId?: string;
  portalId?: string;
  consumerGroupId?: string;
  subjectMode?: MarketplaceManagerSubjectMode;
  edit?: MarketplaceManagerRow;
  onSuccess?: () => void;
}) =>
  showProviderCreationPanel(
    ({ close, setWidth }) => (
      <MarketplaceManagerPanel
        instanceId={props.instanceId}
        skillMarketplaceId={props.skillMarketplaceId}
        portalId={props.portalId}
        consumerGroupId={props.consumerGroupId}
        subjectMode={props.subjectMode}
        edit={props.edit}
        close={close}
        setPanelWidth={setWidth}
        onSuccess={props.onSuccess}
      />
    ),
    {
      width: props.edit || (props.consumerGroupId && props.skillMarketplaceId) ? 660 : 720
    }
  );
