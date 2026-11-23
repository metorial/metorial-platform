import type { DashboardInstanceAgentTrackingViewsListOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  agentTrackingViewsLoader,
  useCreateAgentTrackingView,
  useDeleteAgentTrackingView,
  useUpdateAgentTrackingView
} from '@metorial/state';
import { Button, Callout, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import React from 'react';
import { maxSavedViews, type TeamViewState } from './definitions';
import { savedViewErrorMessage } from './saved';
import { toSavedViewParams } from './state';

export type SavedTeamView = DashboardInstanceAgentTrackingViewsListOutput['items'][number];

export let savedViewsQuery = { page: 'team' as const, limit: maxSavedViews };

export let refreshSavedTeamViews = async (instanceId: string) => {
  await agentTrackingViewsLoader.fetch({ instanceId, ...savedViewsQuery }, { force: true });
};

export let SaveError = ({
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

export let showSaveTeamViewDialog = (p: {
  instanceId: string;
  view: TeamViewState;
  onSaved: (view: SavedTeamView) => void;
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

        await refreshSavedTeamViews(p.instanceId);
        p.onSaved(saved);
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
          Saves the current settings as a view for everyone in this instance.
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

export let showRenameTeamViewDialog = (p: { instanceId: string; savedView: SavedTeamView }) =>
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

        await refreshSavedTeamViews(p.instanceId);
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

// onDeleted runs before the list is refreshed, so a page showing the deleted view can drop it
// from the URL first instead of flashing the "not available" notice.
export let showDeleteTeamViewDialog = (p: {
  instanceId: string;
  savedView: SavedTeamView;
  onDeleted: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let remove = useDeleteAgentTrackingView();

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Delete Saved View</Dialog.Title>
        <Dialog.Description>
          {`"${p.savedView.name}" is removed for everyone in this instance and cannot be restored.`}
        </Dialog.Description>

        <remove.RenderError />

        <Dialog.Actions>
          <Button
            type="button"
            variant="outline"
            size="2"
            disabled={remove.isLoading}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="2"
            color="red"
            loading={remove.isLoading}
            success={remove.isSuccess}
            onClick={async () => {
              let [deleted] = await remove.mutate({
                instanceId: p.instanceId,
                viewId: p.savedView.id
              });
              if (!deleted) return;

              p.onDeleted();
              await refreshSavedTeamViews(p.instanceId);
              close();
            }}
          >
            Delete
          </Button>
        </Dialog.Actions>
      </Dialog.Wrapper>
    );
  });
