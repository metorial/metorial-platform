import type { DashboardInstanceAgentTrackingViewsListOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  agentTrackingViewsLoader,
  useAgentTrackingViews,
  useCreateAgentTrackingView,
  useDeleteAgentTrackingView,
  useUpdateAgentTrackingView
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  confirm,
  Dialog,
  Flex,
  Input,
  Menu,
  showModal,
  Spacer,
  Text,
  type MenuItem
} from '@metorial/ui';
import { RiArrowDownSLine, RiMore2Line } from '@remixicon/react';
import React, { useMemo } from 'react';
import { useAgentTrackingWriteAccess } from '../access';
import {
  maxSavedViews,
  teamViewDefinitions,
  teamViewKinds,
  type TeamViewKind,
  type TeamViewState
} from './definitions';
import { teamViewKindLabel } from './format';
import { resolveSavedSelection, savedViewErrorMessage, sortSavedViews } from './saved';
import {
  canSaveTeamView,
  defaultTeamView,
  fromSavedView,
  isSameTeamView,
  toSavedViewParams,
  type ApplyTeamView
} from './state';

type SavedView = DashboardInstanceAgentTrackingViewsListOutput['items'][number];

let savedViewsQuery = { page: 'team' as const, limit: maxSavedViews };

let builtInPrefix = 'kind:';

let savedPrefix = 'saved:';

let SaveError = ({
  mutator
}: {
  mutator: {
    error: Parameters<typeof savedViewErrorMessage>[0];
    RenderError: () => React.ReactElement | null;
  };
}) => {
  let message = savedViewErrorMessage(mutator.error);
  return message ? <Callout color="red">{message}</Callout> : <mutator.RenderError />;
};

let showSaveAsNewDialog = (p: {
  instanceId: string;
  view: TeamViewState;
  onSaved: (view: SavedView) => Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let create = useCreateAgentTrackingView();

    let form = useForm({
      initialValues: { name: '' },
      onSubmit: async values => {
        let [saved] = await create.mutate({
          instanceId: p.instanceId,
          page: 'team',
          name: values.name,
          kind: p.view.kind,
          params: toSavedViewParams(p.view)
        });
        if (!saved) return;

        await p.onSaved(saved);
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name.')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Save View</Dialog.Title>
        <Dialog.Description>
          {`Saves the ${teamViewKindLabel(p.view.kind)} view with its current settings for everyone who can see Agent Usage in this instance. It never contains members.`}
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            description="Spaces at the ends are removed and runs of spaces become one."
            placeholder="High effort, last 30 days"
            required
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <SaveError mutator={create} />

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              size="2"
              disabled={create.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={create.isLoading}
              success={create.isSuccess}
            >
              Save View
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let showRenameDialog = (p: {
  instanceId: string;
  savedView: SavedView;
  onRenamed: () => Promise<void>;
}) =>
  showModal(({ dialogProps, close }) => {
    let update = useUpdateAgentTrackingView();

    let form = useForm({
      initialValues: { name: p.savedView.name },
      onSubmit: async values => {
        let [renamed] = await update.mutate({
          instanceId: p.instanceId,
          viewId: p.savedView.id,
          name: values.name
        });
        if (!renamed) return;

        await p.onRenamed();
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name.')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Rename Saved View</Dialog.Title>
        <Dialog.Description>
          The new name shows for everyone in this instance.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            description="Spaces at the ends are removed and runs of spaces become one."
            required
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <SaveError mutator={update} />

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              size="2"
              disabled={update.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={update.isLoading}
              success={update.isSuccess}
            >
              Rename
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let menuItems = (views: { error: unknown; list: SavedView[] | null }): MenuItem[] => {
  let builtIns: MenuItem[] = teamViewKinds.map(kind => ({
    id: `${builtInPrefix}${kind}`,
    label: teamViewDefinitions[kind].label,
    description: teamViewDefinitions[kind].description
  }));

  let savedItems: MenuItem[] = views.error
    ? [{ id: 'saved-error', label: 'Saved Views Could Not Be Loaded', disabled: true }]
    : !views.list
      ? [{ id: 'saved-loading', label: 'Loading Saved Views…', disabled: true }]
      : views.list.length
        ? views.list.map(view => ({
            id: `${savedPrefix}${view.id}`,
            label: view.name,
            description: teamViewKindLabel(view.kind),
            disabled: !fromSavedView(view)
          }))
        : [{ id: 'saved-none', label: 'No Saved Views Yet', disabled: true }];

  return [...builtIns, { type: 'separator' }, ...savedItems];
};

export let TeamViewSwitcher = ({
  instanceId,
  view,
  savedId,
  apply,
  current
}: {
  instanceId: string;
  view: TeamViewState;
  savedId: string | null;
  apply: ApplyTeamView;
  current: () => { state: TeamViewState; savedId: string | null };
}) => {
  let canWrite = useAgentTrackingWriteAccess();
  let views = useAgentTrackingViews(instanceId, savedViewsQuery);
  let update = useUpdateAgentTrackingView();
  let remove = useDeleteAgentTrackingView();

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

  let selected = selection.status == 'found' ? selection.view : null;
  let base = selection.status == 'found' ? selection.state : defaultTeamView(view.kind);
  let modified = selection.status != 'loading' && !isSameTeamView(view, base);
  let canSave = canSaveTeamView(view);
  let label = selected?.name ?? teamViewDefinitions[view.kind].label;

  let refreshViews = async () => {
    await agentTrackingViewsLoader.fetch({ instanceId, ...savedViewsQuery }, { force: true });
  };

  let select = (id: string) => {
    if (id.startsWith(builtInPrefix)) {
      apply(defaultTeamView(id.slice(builtInPrefix.length) as TeamViewKind), null, {
        push: true
      });
      return;
    }

    let target = list?.find(item => `${savedPrefix}${item.id}` == id);
    let opened = target && fromSavedView(target);
    if (target && opened) apply(opened, target.id, { push: true });
  };

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
    if (updated) await refreshViews();
  };

  let deleteSaved = (target: SavedView) =>
    confirm({
      title: 'Delete Saved View',
      description: `"${target.name}" is removed for everyone in this instance. This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        let [deleted] = await remove.mutate({ instanceId, viewId: target.id });
        if (!deleted) return;

        let latest = current();
        if (target.id == latest.savedId) apply(latest.state, null);

        await refreshViews();
      }
    });

  return (
    <Flex direction="column" gap={10}>
      <Flex align="center" gap={8} wrap="wrap">
        <Menu
          label="Views"
          title="Views"
          items={menuItems({ error: views.error, list })}
          onItemClick={select}
        >
          <Button size="2" variant="outline" iconRight={<RiArrowDownSLine />}>
            {selection.status == 'loading' ? 'Loading View…' : label}
          </Button>
        </Menu>

        {selected ? (
          <Badge size="1" color="gray">
            {teamViewKindLabel(view.kind)}
          </Badge>
        ) : null}

        {modified ? (
          <Badge size="1" color="blue">
            Modified
          </Badge>
        ) : null}

        {modified && canWrite && selected ? (
          <Button
            size="2"
            disabled={!canSave || remove.isLoading}
            loading={update.isLoading}
            success={update.isSuccess}
            onClick={save}
          >
            Save
          </Button>
        ) : null}

        {modified && canWrite ? (
          <Button
            size="2"
            variant="outline"
            disabled={!canSave || update.isLoading}
            onClick={() => {
              let state = latestSavable();
              if (!state) return;

              showSaveAsNewDialog({
                instanceId,
                view: state,
                onSaved: async created => {
                  await refreshViews();
                  apply(state, created.id);
                }
              });
            }}
          >
            Save as New
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
                onClick: () =>
                  showRenameDialog({
                    instanceId,
                    savedView: selected,
                    onRenamed: refreshViews
                  })
              },
              { id: 'delete', label: 'Delete', onClick: () => deleteSaved(selected) }
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

        <remove.RenderError />

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
      </Flex>

      {modified && canWrite && !canSave ? (
        <Text size="1" color="gray600">
          Choose at least one model to save this view.
        </Text>
      ) : null}

      <SaveError mutator={update} />

      {selection.status == 'unavailable' ? (
        <Callout color="gray">
          The saved view in this link is not available. The page shows the settings from the
          link instead.
        </Callout>
      ) : null}

      <Text size="2" color="gray600">
        {teamViewDefinitions[view.kind].description}
      </Text>
    </Flex>
  );
};
