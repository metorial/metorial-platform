import { useAgentTrackingViews, useUpdateAgentTrackingView } from '@metorial/state';
import { Badge, Button, Callout, Flex, Menu, Text, Title } from '@metorial/ui';
import { RiMore2Line } from '@remixicon/react';
import React, { useMemo } from 'react';
import { WithInfo } from '../info';
import { useTeamViewActions } from './actions';
import { teamViewDefinitions, type TeamViewState } from './definitions';
import { refreshSavedTeamViews, SaveError } from './dialogs';
import { teamViewKindLabel } from './format';
import { resolveSavedSelection, savedViewsQuery, sortSavedViews } from './saved';
import {
  canSaveTeamView,
  defaultTeamView,
  isSameTeamView,
  toSavedViewParams,
  type ApplyTeamView
} from './state';

export let TeamViewHeader = ({
  instanceId,
  view,
  savedId,
  apply,
  children
}: {
  instanceId: string;
  view: TeamViewState;
  savedId: string | null;
  apply: ApplyTeamView;
  children?: React.ReactNode;
}) => {
  let actions = useTeamViewActions({ instanceId, onTeamPage: true });
  let views = useAgentTrackingViews(instanceId, savedViewsQuery);
  let update = useUpdateAgentTrackingView();

  let list = useMemo(
    () => (views.data ? sortSavedViews(views.data.items) : null),
    [views.data]
  );
  let selection = resolveSavedSelection({
    savedId,
    urlKind: view.kind,
    views: list,
    listFailed: !!views.error
  });

  let definition = teamViewDefinitions[view.kind];
  let selected = selection.status == 'found' ? selection.view : null;
  let base = selection.status == 'found' ? selection.state : defaultTeamView(view.kind);
  let modified = selection.status != 'loading' && !isSameTeamView(view, base);
  let canSave = canSaveTeamView(view);
  let title =
    selection.status == 'loading' ? 'Loading View…' : (selected?.name ?? definition.label);

  let save = async () => {
    let latest = actions.latestSavable();
    if (!selected || !latest || latest.savedId != selected.id) return;
    if (latest.state.kind != selected.kind) return;

    let [updated] = await update.mutate({
      instanceId,
      viewId: selected.id,
      params: toSavedViewParams(latest.state)
    });
    if (updated) await refreshSavedTeamViews(instanceId);
  };

  return (
    <Flex direction="column" gap={16}>
      <Flex align="start" justify="space-between" gap={12} wrap="wrap">
        <Flex direction="column" gap={4} style={{ flex: '1 1 320px', minWidth: 0 }}>
          {selected ? (
            <Text size="1" color="gray600">
              {teamViewKindLabel(view.kind)}
            </Text>
          ) : null}

          <WithInfo info={definition.description}>
            <Title as="h2" size="5" weight="strong">
              {title}
            </Title>
          </WithInfo>
        </Flex>

        <Flex align="center" gap={8} wrap="wrap">
          {modified && selected ? (
            <Badge size="1" color="blue">
              Modified
            </Badge>
          ) : null}

          {modified && actions.canWrite && canSave && selected ? (
            <Button
              size="2"
              loading={update.isLoading}
              success={update.isSuccess}
              onClick={save}
            >
              Save
            </Button>
          ) : null}

          {actions.canCreate && canSave && (!selected || modified) ? (
            <Button
              size="2"
              variant={selected ? 'outline' : undefined}
              disabled={update.isLoading}
              onClick={actions.saveAsNew}
            >
              {selected ? 'Save as New' : 'Save as View'}
            </Button>
          ) : null}

          {modified ? (
            <Button
              size="2"
              variant="outline"
              disabled={update.isLoading}
              onClick={() => apply(base, selected ? selected.id : null)}
            >
              Reset
            </Button>
          ) : null}

          {actions.canWrite && selected ? (
            <Menu
              label="Saved View Actions"
              items={[
                { id: 'rename', label: 'Rename', onClick: () => actions.rename(selected) },
                { id: 'delete', label: 'Delete', onClick: () => actions.remove(selected) }
              ]}
            >
              <Button
                size="2"
                variant="ghost"
                iconLeft={<RiMore2Line />}
                aria-label="Saved View Actions"
                title="Saved View Actions"
              />
            </Menu>
          ) : null}
        </Flex>
      </Flex>

      {children ? (
        <Flex align="center" gap={10} wrap="wrap" style={{ minWidth: 0 }}>
          {children}
        </Flex>
      ) : null}

      <SaveError mutator={update} />

      {views.error ? (
        <Flex align="center" gap={6}>
          <Text size="1" color="gray600">
            Saved views could not be loaded.
          </Text>
          <Button size="1" variant="soft" onClick={() => views.refetch()}>
            Retry
          </Button>
        </Flex>
      ) : null}

      {selection.status == 'unavailable' ? (
        <Callout color="gray">
          The saved view in this link is not available. The page shows the settings from the
          link instead.
        </Callout>
      ) : null}
    </Flex>
  );
};
