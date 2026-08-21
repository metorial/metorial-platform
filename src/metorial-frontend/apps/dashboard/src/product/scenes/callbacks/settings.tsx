import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useArchiveCallback,
  useCallback,
  useCurrentInstance,
  useProvider
} from '@metorial/state';
import { Button, Callout, Input, Spacer, toast } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { DeleteResourceDangerZone } from '../deleteResourceDangerZone';

export let CallbackSettings = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callbackLoader = useCallback(instance.data?.id, p.callbackId);
  let provider = useProvider(
    instance.data?.id,
    callbackLoader.data?.providerDeployment.providerId
  );
  let updateCallback = callbackLoader.useUpdateMutator();
  let archiveCallback = useArchiveCallback();
  let generalForm = useForm({
    initialValues: {
      name: callbackLoader.data?.name ?? '',
      description: callbackLoader.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateCallback.mutate({
        name: values.name.trim(),
        description: values.description.trim()
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Enter a name'),
        description: yup.string()
      }) as any
  });

  return renderWithLoader({ callback: callbackLoader, provider })(({ callback, provider }) => {
    if (callback.data.status !== 'active') {
      return (
        <Callout color="orange">
          This callback is archived. Its trigger registrations have been removed and no events
          are received or delivered. Archiving cannot be undone from the dashboard.
        </Callout>
      );
    }

    return (
      <>
        <Box title="General" description="Rename this callback or update its description.">
          <form onSubmit={generalForm.handleSubmit}>
            <Input label="Name" {...generalForm.getFieldProps('name')} />
            <generalForm.RenderError field="name" />

            <Spacer height={15} />

            <Input label="Description" {...generalForm.getFieldProps('description')} />
            <generalForm.RenderError field="description" />

            <Spacer height={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="2"
                type="submit"
                loading={updateCallback.isLoading}
                success={updateCallback.isSuccess}
              >
                Save
              </Button>
            </div>

            <updateCallback.RenderError />
          </form>
        </Box>

        <Spacer height={15} />

        <DeleteResourceDangerZone
          description={`Archive this callback to permanently stop receiving ${provider.data.name} events. All trigger registrations are removed and its instances are detached.`}
          buttonLabel="Archive Callback"
          confirmTitle="Archive callback"
          confirmDescription={`No more ${provider.data.name} events will be received or delivered for this callback, and its trigger registrations will be removed. Archiving cannot be undone from the dashboard.`}
          confirmText="Archive"
          loading={archiveCallback.isLoading}
          success={archiveCallback.isSuccess}
          onDelete={async () => {
            if (!instance.data) return;

            let [result] = await archiveCallback.mutate({
              instanceId: instance.data.id,
              callbackId: callback.data.id
            });
            if (!result) return;

            toast.success('Callback archived');
            callbackLoader.refetch?.();
          }}
        >
          <archiveCallback.RenderError />
        </DeleteResourceDangerZone>
      </>
    );
  });
};
