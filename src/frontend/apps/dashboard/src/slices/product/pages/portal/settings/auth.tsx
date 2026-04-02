import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreatePortalAuthSsoTenant,
  useCreatePortalAuthSsoTenantSetup,
  useCurrentInstance,
  usePortal,
  usePortalAuthApp,
  usePortalAuthSsoTenants
} from '@metorial/state';
import {
  Attributes,
  Button,
  Dialog,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let showCreateSsoTenantModal = (props: {
  instanceId: string;
  portalId: string;
  onCreate: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createTenant = useCreatePortalAuthSsoTenant();
    let form = useForm({
      initialValues: {
        name: ''
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required')
        }),
      onSubmit: async values => {
        let [created] = await createTenant.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          name: values.name
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={520}>
        <Dialog.Title>Create SSO Tenant</Dialog.Title>
        <Dialog.Description>
          Create a new Ares SSO tenant for this portal.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={createTenant.isLoading}>
              Create Tenant
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalSettingsAuthPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);
  let authApp = usePortalAuthApp(instance.data?.id, portalId);
  let ssoTenants = usePortalAuthSsoTenants(instance.data?.id, portalId, { limit: 100 });
  let createTenantSetup = useCreatePortalAuthSsoTenantSetup();
  let updatePortal = portal.useUpdateMutator();

  let form = useForm({
    initialValues: {
      sessionExpiryTimeInSeconds: String(
        portal.data?.auth.sessionExpiryTimeInSeconds ?? 604800
      )
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updatePortal.mutate({
        sessionExpiryTimeInSeconds: Number(values.sessionExpiryTimeInSeconds)
      });
    },
    schema: yup =>
      yup.object({
        sessionExpiryTimeInSeconds: yup
          .number()
          .integer('Must be a whole number')
          .min(600, 'Session expiry must be at least 600 seconds')
          .required('Session expiry is required')
      })
  });

  if (!portalId) return null;

  let ssoTenantsContent = renderWithPagination(ssoTenants, {
    hidePaginationWhenUnavailable: true
  })(ssoTenants => (
    <>
      <Table
        headers={['Name', 'Client ID', 'Connections', 'Created', '']}
        data={ssoTenants.data.items.map(tenant => ({
          data: [
            tenant.name,
            tenant.clientId,
            String(tenant.counts.connections),
            <RenderDate date={tenant.createdAt} />,
            <Button
              size="1"
              loading={createTenantSetup.isLoading}
              onClick={async () => {
                let [setup] = await createTenantSetup.mutate({
                  instanceId: instance.data!.id,
                  portalId,
                  ssoTenantId: tenant.id
                });

                if (!setup) return;

                window.open(setup.url, '_blank', 'noopener,noreferrer');
              }}
            >
              Continue Setup
            </Button>
          ]
        }))}
      />

      {ssoTenants.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No SSO tenants are configured for this portal yet.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ portal, authApp })(({ authApp }) => (
    <>
      <Box
        title="Authentication Settings"
        description="Manage authentication settings for users accessing this portal."
      >
        <form onSubmit={form.handleSubmit}>
          <Input
            label="Session Expiry Time (seconds)"
            type="number"
            {...form.getFieldProps('sessionExpiryTimeInSeconds')}
          />
          <form.RenderError field="sessionExpiryTimeInSeconds" />

          <Spacer size={15} />

          <Button
            size="2"
            type="submit"
            loading={updatePortal.isLoading}
            success={updatePortal.isSuccess}
          >
            Save
          </Button>
        </form>
      </Box>

      <Spacer size={15} />

      <Box title="Auth Application" description="The portal auth application used for redirects and SSO.">
        <Attributes
          itemWidth="260px"
          attributes={[
            {
              label: 'Client ID',
              content: authApp.data.clientId
            },
            {
              label: 'Default Redirect URL',
              content: authApp.data.defaultRedirectUrl
            },
            {
              label: 'Redirect Domains',
              content: authApp.data.redirectDomains.join(', ')
            },
            {
              label: 'Created',
              content: <RenderDate date={authApp.data.createdAt} />
            }
          ]}
        />
      </Box>

      <Spacer size={15} />

      <Box
        title="SSO Tenants"
        description="Create and continue setup for the SSO tenants attached to this portal."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showCreateSsoTenantModal({
                instanceId: instance.data.id,
                portalId,
                onCreate: () => ssoTenants.refetch()
              })
            }
          >
            Create SSO Tenant
          </Button>
        }
      >
        {ssoTenantsContent}
      </Box>
    </>
  ));
};
