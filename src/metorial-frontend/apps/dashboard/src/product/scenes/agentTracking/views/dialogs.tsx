import { useForm } from '@metorial/data-hooks';
import {
  agentTrackingViewsLoader,
  useCreateAgentTrackingView,
  useDeleteAgentTrackingView,
  useUpdateAgentTrackingView
} from '@metorial/state';
import { Button, Callout, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import React from 'react';
import type { TeamViewState } from './definitions';
import { savedViewErrorMessage, savedViewsQuery, type SavedTeamView } from './saved';
import { toSavedViewParams } from './state';

type NameDialog =
  | {
      mode: 'save';
      instanceId: string;
      view: TeamViewState;
      onSaved: (view: SavedTeamView) => void;
    }
  | { mode: 'rename'; instanceId: string; savedView: SavedTeamView };

let nameDialogCopy = {
  save: {
    title: 'Save View',
    description: 'Saves the current settings as a view for everyone in this instance.',
    placeholder: 'High effort, last 30 days',
    submit: 'Save View'
  },
  rename: {
    title: 'Rename Saved View',
    description: 'The new name shows for everyone in this instance.',
    placeholder: undefined,
    submit: 'Rename'
  }
};

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

export let showTeamViewNameDialog = (p: NameDialog) =>
  showModal(({ dialogProps, close }) => {
    let create = useCreateAgentTrackingView();
    let update = useUpdateAgentTrackingView();
    let mutator = p.mode == 'save' ? create : update;
    let copy = nameDialogCopy[p.mode];

    let form = useForm({
      initialValues: { name: p.mode == 'save' ? '' : p.savedView.name },
      onSubmit: async values => {
        if (p.mode == 'save') {
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
        } else {
          let [renamed] = await update.mutate({
            instanceId: p.instanceId,
            viewId: p.savedView.id,
            name: values.name
          });
          if (!renamed) return;

          await refreshSavedTeamViews(p.instanceId);
        }

        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name.')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>{copy.title}</Dialog.Title>
        <Dialog.Description>{copy.description}</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            description="Spaces at the ends are removed and runs of spaces become one."
            placeholder={copy.placeholder}
            required
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <SaveError mutator={mutator} />

          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              size="2"
              disabled={mutator.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={mutator.isLoading}
              success={mutator.isSuccess}
            >
              {copy.submit}
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

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
