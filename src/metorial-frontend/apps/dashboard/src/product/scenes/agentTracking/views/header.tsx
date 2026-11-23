import { useAgentTrackingViews, useUpdateAgentTrackingView } from '@metorial/state';
import { Badge, Button, Callout, Flex, Menu, Text, Title } from '@metorial/ui';
import { RiMore2Line } from '@remixicon/react';
import React, { useMemo } from 'react';
import { useAgentTrackingWriteAccess } from '../access';
import { WithInfo } from '../info';
import { teamViewDefinitions, type TeamViewState } from './definitions';
import {
  refreshSavedTeamViews,
  SaveError,
  savedViewsQuery,
  showDeleteTeamViewDialog,
  showRenameTeamViewDialog,
  showSaveTeamViewDialog
} from './dialogs';
import { teamViewKindLabel } from './format';
import { resolveSavedSelection, sortSavedViews } from './saved';
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
  current,
  children
}: {
  instanceId: string;
  view: TeamViewState;
  savedId: string | null;
  apply: ApplyTeamView;
  current: () => { state: TeamViewState; savedId: string | null };
  children?: React.ReactNode;
}) => {
  let canWrite = useAgentTrackingWriteAccess();
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

  let latestSavable = () => {
    let latest = current();
    return latest.savedId == savedId && canSaveTeamView(latest.state) ? latest.state : null;
  };

  let save = async () => {
    let state = latestSavable();
    if (!selected || !state || selected.kind != state.kind) return;

    let [updated] = await update.mutate({
      instanceId,
      viewId: selected.id,
      params: toSavedViewParams(state)
    });
    if (updated) await refreshSavedTeamViews(instanceId);
  };

  let saveAsNew = () => {
    let state = latestSavable();
    if (!state) return;

    showSaveTeamViewDialog({
      instanceId,
      view: state,
      onSaved: created => apply(state, created.id)
    });
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

          {modified && canWrite && canSave && selected ? (
            <Button
              size="2"
              loading={update.isLoading}
              success={update.isSuccess}
              onClick={save}
            >
              Save
            </Button>
          ) : null}

          {canWrite && canSave && (!selected || modified) ? (
            <Button
              size="2"
              variant={selected ? 'outline' : undefined}
              disabled={update.isLoading}
              onClick={saveAsNew}
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

          {canWrite && selected ? (
            <Menu
              label="Saved View Actions"
              items={[
                {
                  id: 'rename',
                  label: 'Rename',
                  onClick: () => showRenameTeamViewDialog({ instanceId, savedView: selected })
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  onClick: () =>
                    showDeleteTeamViewDialog({
                      instanceId,
                      savedView: selected,
                      onDeleted: () => {
                        let latest = current();
                        if (latest.savedId == selected.id) apply(latest.state, null);
                      }
                    })
                }
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
