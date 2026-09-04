import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpServer,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstance,
  useMagicMcpServers,
  useProjectAuthConfigConfiguration,
  type IntegrationInstance
} from '@metorial/state';
import {
  Attributes,
  Badge,
  Button,
  Callout,
  Input,
  Panel,
  RenderDate,
  showModal,
  Spacer,
  Text
} from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { IntegrationInstanceProvidersManager } from '../../../scenes/integrations/providersManager';

let getIntegrationInstanceStatusColor = (status: string) => {
  if (status === 'active') return 'green';
  if (status === 'draft') return 'orange';
  if (status === 'archived') return 'orange';
  return 'gray';
};

let capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

let getProviderManagementMode = (mode: string) => {
  if (mode === 'inherited_from_provider_template') {
    return { label: 'Provider Template', color: 'purple' as const };
  }
  if (mode === 'inherited_from_integration') {
    return { label: 'Integration Instance', color: 'blue' as const };
  }
  return { label: 'Server Owned', color: 'gray' as const };
};

let CreateLinkedMagicMcpServerModal = (p: {
  instanceId: string;
  integrationInstance: IntegrationInstance;
  close: () => void;
  dialogProps: any;
  onCreate: () => void;
}) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let createMutator = useCreateMagicMcpServer();

  let form = useForm({
    initialValues: {
      name: `${p.integrationInstance.name} MCP Server`,
      description: p.integrationInstance.description ?? ''
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      }),
    onSubmit: async values => {
      let [server] = await createMutator.mutate({
        instanceId: p.instanceId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        integrationInstanceId: p.integrationInstance.id
      });
      if (!server || !instance.data) return;

      p.onCreate();
      p.close();

      navigate(
        Paths.instance.magicMcp.server(
          instance.data.organization,
          instance.data.project,
          instance.data,
          server.id
        )
      );
    }
  });

  return (
    <Panel.Wrapper {...p.dialogProps}>
      <Panel.Header>
        <Panel.Title>Create Magic MCP Server</Panel.Title>
        <Panel.Description>
          Create a Magic MCP server linked to this integration instance. Providers will be
          inherited from the integration instance and cannot be changed on the server.
        </Panel.Description>
      </Panel.Header>

      <Panel.Content>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" required {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <createMutator.RenderError />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button type="button" variant="outline" onClick={p.close}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutator.isLoading}>
              Create Server
            </Button>
          </div>
        </form>
      </Panel.Content>
    </Panel.Wrapper>
  );
};

let LinkedMagicMcpServersBox = (p: {
  instanceId: string;
  integrationInstance: IntegrationInstance;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let authConfig = useProjectAuthConfigConfiguration(organization.data?.id, project.data?.id);
  let servers = useMagicMcpServers(p.instanceId, {
    integrationInstanceId: p.integrationInstance.id,
    owner: ['organization', 'consumer'],
    status: ['active'],
    limit: 100
  });
  let isBlockedByOAuthPolicy =
    authConfig.data?.onlyAllowOauthAuthMethods && !p.integrationInstance.isOauthCompatible;
  let canCreate =
    p.integrationInstance.status === 'active' && p.integrationInstance.providers.length > 0;

  let openCreate = () => {
    if (!canCreate) return;

    showModal(({ dialogProps, close }) => (
      <CreateLinkedMagicMcpServerModal
        instanceId={p.instanceId}
        integrationInstance={p.integrationInstance}
        close={close}
        dialogProps={dialogProps}
        onCreate={() => servers.refetch()}
      />
    ));
  };

  return (
    <Box
      title="Magic MCP Servers"
      description="Magic MCP servers using this integration instance, including servers created from provider templates."
      rightActions={
        <Button size="2" onClick={openCreate} disabled={!canCreate || isBlockedByOAuthPolicy}>
          Create Magic MCP Server
        </Button>
      }
    >
      {isBlockedByOAuthPolicy && (
        <Callout color="orange">
          This integration instance uses a non-OAuth authentication method and cannot be linked
          to a new Magic MCP server while the project OAuth-only policy is enabled.
        </Callout>
      )}

      {renderWithPagination(servers)(servers => (
        <>
          <Table
            headers={['Name', 'Type', 'Created']}
            data={servers.data.items.map(server => {
              let providerManagementMode = getProviderManagementMode(
                server.providerManagementMode
              );

              return {
                data: [
                  <Text size="2" weight="strong">
                    {server.name ?? 'Magic MCP Server'}
                  </Text>,
                  <Badge color={providerManagementMode.color}>
                    {providerManagementMode.label}
                  </Badge>,
                  <RenderDate date={server.createdAt} />
                ],
                href: Paths.instance.magicMcp.server(
                  organization.data,
                  project.data,
                  instance.data,
                  server.id
                )
              };
            })}
          />

          {servers.data.items.length === 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No Magic MCP servers use this integration instance yet.
            </Text>
          )}
        </>
      ))}
    </Box>
  );
};

export let IntegrationInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { integrationInstanceId } = useParams();
  let integrationInstance = useIntegrationInstance(instance.data?.id, integrationInstanceId);
  let integration = useIntegration(instance.data?.id, integrationInstance.data?.integrationId);

  return renderWithLoader({ integrationInstance, integration })(
    ({ integrationInstance, integration }) => {
      let onComplete = () => integrationInstance.refetch();

      return (
        <>
          <Attributes
            itemWidth="360px"
            attributes={[
              { label: 'ID', content: <ID id={integrationInstance.data.id} /> },
              {
                label: 'Status',
                content: (
                  <Badge
                    color={getIntegrationInstanceStatusColor(integrationInstance.data.status)}
                  >
                    {capitalize(integrationInstance.data.status)}
                  </Badge>
                )
              },
              {
                label: 'Identity',
                content: integrationInstance.data.identityId ? (
                  <ID id={integrationInstance.data.identityId} />
                ) : (
                  '-'
                )
              }
            ]}
          />

          {integrationInstance.data.status === 'draft' ? (
            <>
              <Spacer height={20} />
              <Callout color="orange">
                This integration instance is still a draft and cannot be used yet. It first
                needs to be configured.
              </Callout>
            </>
          ) : null}

          <Spacer height={20} />

          <Box
            title="Providers"
            description="Review the providers attached to this integration and configure per-instance overrides where needed."
          >
            <IntegrationInstanceProvidersManager
              instanceId={instance.data!.id}
              integration={integration.data}
              integrationInstance={integrationInstance.data}
              onComplete={onComplete}
            />
          </Box>

          <Spacer height={20} />

          <LinkedMagicMcpServersBox
            instanceId={instance.data!.id}
            integrationInstance={integrationInstance.data}
          />
        </>
      );
    }
  );
};
