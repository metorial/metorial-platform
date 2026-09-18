import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpServer,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegration,
  useIntegrationInstance,
  useIntegrationInstanceProviders,
  useMagicMcpServers,
  useProjectAuthConfigConfiguration,
  type IntegrationInstance,
  type IntegrationProvider
} from '@metorial/state';
import { Badge, Button, Callout, Input, Panel, showModal, Spacer, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { showIntegrationInstanceProviderPanelFlow } from '../../../scenes/integrations/providerPanelFlow';
import { IntegrationInstanceProvidersManager } from '../../../scenes/integrations/providersManager';

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
      description="Magic MCP servers using this integration instance."
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
            headers={['Name', 'Type']}
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
                  </Badge>
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
  let instanceProviders = useIntegrationInstanceProviders(
    instance.data?.id && integrationInstanceId ? instance.data.id : null,
    integrationInstanceId
      ? { integrationInstanceId, status: ['active', 'archived'] }
      : undefined
  );
  let location = useLocation();
  let navigate = useNavigate();
  let autoConfigureHandledRef = useRef(false);
  let shouldAutoConfigure = Boolean(
    (location.state as { configurePendingIntegrationProvider?: boolean } | null)
      ?.configurePendingIntegrationProvider
  );

  useEffect(() => {
    if (!shouldAutoConfigure || autoConfigureHandledRef.current) return;
    if (!integrationInstance.data || !integration.data || !instanceProviders.data) return;

    autoConfigureHandledRef.current = true;
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null
    });

    let integrationProviders = integration.data.providers ?? [];
    let integrationProvider = integrationProviders[0];
    let hasConfiguredProvider = instanceProviders.data.items.some(
      provider => provider.integrationProvider.id === integrationProvider?.id
    );

    if (
      integrationInstance.data.status !== 'draft' ||
      integrationProviders.length !== 1 ||
      !integrationProvider ||
      hasConfiguredProvider
    ) {
      return;
    }

    showIntegrationInstanceProviderPanelFlow({
      integration: integration.data,
      integrationInstance: integrationInstance.data,
      integrationProvider: integrationProvider as IntegrationProvider,
      onComplete: () => {
        void integrationInstance.refetch();
        void instanceProviders.refetch();
      }
    });
  }, [
    shouldAutoConfigure,
    integrationInstance.data,
    integration.data,
    instanceProviders.data,
    location.pathname,
    location.search,
    location.hash,
    navigate
  ]);

  return renderWithLoader({ integrationInstance, integration, instanceProviders })(
    ({ integrationInstance, integration }) => {
      let onComplete = () => {
        void integrationInstance.refetch();
        void instanceProviders.refetch();
      };

      return (
        <DetailsOverviewLayout>
          {integrationInstance.data.status === 'draft' ? (
            <>
              <Callout color="orange">
                This integration instance is still a draft and cannot be used yet. It first
                needs to be configured.
              </Callout>
              <Spacer height={20} />
            </>
          ) : null}

          <Box
            title="Providers"
            description="Manage the configuration of the providers attached to this integration."
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
        </DetailsOverviewLayout>
      );
    }
  );
};
