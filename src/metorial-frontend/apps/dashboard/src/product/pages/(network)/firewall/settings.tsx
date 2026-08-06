import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useFirewall
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { Stack } from '../_common';

export let NetworkFirewallSettingsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { firewallId } = useParams();
  let firewall = useFirewall(instance.data?.id, firewallId);
  let updateFirewall = firewall.useUpdateMutator();
  let deleteFirewall = firewall.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: firewall.data?.name ?? '',
      description: firewall.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateFirewall.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      }) as any
  });

  return renderWithLoader({ firewall })(() => (
    <Stack>
      <Box title="Firewall Settings" description="Update the firewall definition.">
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <Spacer size={12} />
          <Button
            size="2"
            type="submit"
            loading={updateFirewall.isLoading}
            success={updateFirewall.isSuccess}
          >
            Save
          </Button>
          <updateFirewall.RenderError />
        </form>
      </Box>

      <Box title="Danger Zone" description="Archive this firewall.">
        <Button
          color="red"
          variant="solid"
          size="2"
          loading={deleteFirewall.isLoading}
          onClick={async () => {
            let [res] = await deleteFirewall.mutate({});
            if (!res) return;

            navigate(
              Paths.organization.instance.networkFirewalls(
                organization.data,
                project.data,
                instance.data
              )
            );
          }}
        >
          Delete Firewall
        </Button>
        <deleteFirewall.RenderError />
      </Box>
    </Stack>
  ));
};
