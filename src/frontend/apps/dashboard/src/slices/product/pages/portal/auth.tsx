import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCreatePortalAuthSsoTenant,
  useCreatePortalAuthSsoTenantSetup,
  useCurrentInstance,
  usePortalAuthApp,
  usePortalAuthSsoTenants
} from '@metorial/state';
import {
  Button,
  Dialog,
  Entity,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let TenantList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

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
        <Dialog.Description>Create a new Ares SSO tenant for this portal.</Dialog.Description>

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

export let PortalAuthPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let authApp = usePortalAuthApp(instance.data?.id, portalId);
  let ssoTenants = usePortalAuthSsoTenants(instance.data?.id, portalId);
  let createTenantSetup = useCreatePortalAuthSsoTenantSetup();

  if (!portalId) return null;

  return renderWithLoader({ instance, authApp })(({ instance, authApp }) => (
    <>
      <Spacer size={15} />

      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field title="Client ID" value={authApp.data.clientId} />
          <Entity.Field title="Default Redirect URL" value={authApp.data.defaultRedirectUrl} />
          <Entity.Field
            title="Redirect Domains"
            value={authApp.data.redirectDomains.join(', ')}
          />
          <Entity.Field title="Created" value={<RenderDate date={authApp.data.createdAt} />} />
        </Entity.Content>
      </Entity.Wrapper>

      <Spacer size={15} />

      <Button
        onClick={() =>
          showCreateSsoTenantModal({
            instanceId: instance.data.id,
            portalId,
            onCreate: () => ssoTenants.refetch()
          })
        }
      >
        Create SSO Tenant
      </Button>

      <Spacer size={15} />

      {renderWithPagination(ssoTenants, {
        hidePaginationWhenUnavailable: true
      })(ssoTenants => (
        <TenantList>
          {ssoTenants.data.items.map(tenant => (
            <Entity.Wrapper key={tenant.id}>
              <Entity.Content>
                <Entity.Field title={tenant.name} value={tenant.status} />
                <Entity.Field title="Client ID" value={tenant.clientId} />
                <Entity.Field title="Connections" value={String(tenant.counts.connections)} />
                <Entity.Field title="Created" value={<RenderDate date={tenant.createdAt} />} />
                <Entity.Field
                  title="Actions"
                  right
                  value={
                    <Button
                      size="1"
                      loading={createTenantSetup.isLoading}
                      onClick={async () => {
                        let [setup] = await createTenantSetup.mutate({
                          instanceId: instance.data.id,
                          portalId,
                          ssoTenantId: tenant.id
                        });

                        if (!setup) return;

                        window.open(setup.url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Continue Setup
                    </Button>
                  }
                />
              </Entity.Content>
            </Entity.Wrapper>
          ))}

          {ssoTenants.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No SSO tenants are configured for this portal yet.
            </Text>
          )}
        </TenantList>
      ))}
    </>
  ));
};
