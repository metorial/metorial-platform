import { renderWithLoader, useForm, useMutation } from '@metorial-io/data-hooks';
import {
  Badge,
  Button,
  Checkbox,
  Datalist,
  Dialog,
  Input,
  Select,
  showModal,
  Spacer,
  Text,
  Title
} from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { Link, useParams } from 'react-router-dom';
import {
  accessGroupsState,
  appAccessGroupAssignmentsState,
  appState,
  globalSsoTenantsState,
  oauthProvidersState,
  ssoTenantsState
} from '../../../state';
import { adminClient } from '../../../state/client';

export let AppPage = () => {
  let { appId } = useParams();
  let app = appState.use({ id: appId! });
  let ssoTenants = ssoTenantsState.use({ appId: appId! });
  let ssoTenantsRoot = ssoTenants;
  let globalSsoTenants = globalSsoTenantsState.use();
  let oauthProviders = oauthProvidersState.use({ appId: appId! });
  let oauthProvidersRoot = oauthProviders;
  let accessGroups = accessGroupsState.use({ appId: appId! });
  let appAssignments = appAccessGroupAssignmentsState.use({ appId: appId! });
  let appAssignmentsRoot = appAssignments;

  return renderWithLoader({
    app,
    ssoTenants,
    globalSsoTenants,
    oauthProviders,
    accessGroups,
    appAssignments
  })(({ app, ssoTenants, globalSsoTenants, oauthProviders, accessGroups, appAssignments }) => (
    <>
      <Title weight="strong" as="h1" size="7">
        {app.data.clientId}
      </Title>

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        App Details
      </Title>

      <Datalist
        items={[
          { label: 'ID', value: app.data.id },
          { label: 'Client ID', value: app.data.clientId },
          { label: 'Slug', value: app.data.slug ?? '-' },
          { label: 'Has Terms', value: app.data.hasTerms ? 'Yes' : 'No' },
          { label: 'Sessionless', value: app.data.isSessionless ? 'Yes' : 'No' },
          {
            label: 'Email Authentication',
            value: app.data.disableEmailAuth ? 'Disabled' : 'Enabled'
          },
          { label: 'Default Redirect URL', value: app.data.defaultRedirectUrl ?? '-' },
          { label: 'Default Tenant', value: app.data.defaultTenant?.clientId ?? '-' },
          { label: 'Users', value: app.data.counts.users },
          { label: 'Tenants', value: app.data.counts.tenants },
          {
            label: 'Created At',
            value: new Date(app.data.createdAt).toLocaleDateString('de-at')
          },
          {
            label: 'Updated At',
            value: new Date(app.data.updatedAt).toLocaleDateString('de-at')
          }
        ]}
      />

      <AppSettingsSection appId={appId!} app={app} />

      <RedirectDomainsSection appId={appId!} app={app} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          OAuth Providers
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let create = useMutation(adminClient.oauthProvider.create);

              let form = useForm({
                initialValues: {
                  provider: 'google' as 'google' | 'github',
                  clientId: '',
                  clientSecret: '',
                  redirectUri: ''
                },
                onSubmit: async values => {
                  let [res] = await create.mutate({
                    appId: appId!,
                    provider: values.provider,
                    clientId: values.clientId,
                    clientSecret: values.clientSecret,
                    redirectUri: values.redirectUri
                  });
                  if (res) {
                    close();
                    oauthProvidersRoot.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    provider: yup.string().oneOf(['google', 'github']).required(),
                    clientId: yup.string().required('Client ID is required'),
                    clientSecret: yup.string().required('Client Secret is required'),
                    redirectUri: yup
                      .string()
                      .url('Must be a valid URL')
                      .required('Redirect URI is required')
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Add OAuth Provider</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Select
                      label="Provider"
                      value={form.values.provider}
                      onChange={val => form.setFieldValue('provider', val)}
                      items={[
                        { id: 'google', label: 'Google' },
                        { id: 'github', label: 'GitHub' }
                      ]}
                    />

                    <Input label="Client ID" {...form.getFieldProps('clientId')} />
                    <form.RenderError field="clientId" />

                    <Spacer size={15} />

                    <Input label="Client Secret" {...form.getFieldProps('clientSecret')} />
                    <form.RenderError field="clientSecret" />

                    <Spacer size={15} />

                    <Input label="Redirect URI" {...form.getFieldProps('redirectUri')} />
                    <form.RenderError field="redirectUri" />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={create.isLoading}
                      success={create.isSuccess}
                    >
                      Create
                    </Button>
                    <create.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Add OAuth Provider
        </Button>
      </div>

      <Table
        headers={['Provider', 'Client ID', 'Redirect URI', 'Enabled', 'Created At', '']}
        data={oauthProviders.data.items.map((provider: any) => [
          provider.provider,
          provider.clientId,
          provider.redirectUri,
          provider.enabled ? 'Yes' : 'No',
          new Date(provider.createdAt).toLocaleDateString('de-at'),
          <OAuthProviderActions
            provider={provider}
            onUpdate={() => oauthProvidersRoot.refetch()}
          />
        ])}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          SSO Tenants
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let create = useMutation(adminClient.sso.createTenant);

              let form = useForm({
                initialValues: { name: '' },
                onSubmit: async values => {
                  let [res] = await create.mutate({
                    appId: appId!,
                    name: values.name
                  });
                  if (res) {
                    close();
                    ssoTenantsRoot.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    name: yup.string().required('Name is required')
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Create SSO Tenant</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Input label="Name" {...form.getFieldProps('name')} />
                    <form.RenderError field="name" />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={create.isLoading}
                      success={create.isSuccess}
                    >
                      Create
                    </Button>
                    <create.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Create SSO Tenant
        </Button>
      </div>

      <Table
        headers={['Name', 'Status', 'Connections', 'Created At', '']}
        data={[
          ...ssoTenants.data.items.map((tenant: any) => ({
            data: [
              <>
                {tenant.name}
                {tenant.isGlobal && (
                  <Badge color="blue" style={{ marginLeft: 8 }}>
                    Global
                  </Badge>
                )}
              </>,
              tenant.status,
              tenant.counts.connections,
              new Date(tenant.createdAt).toLocaleDateString('de-at'),
              <Button as="span" size="1">
                View
              </Button>
            ],
            href: `/apps/${appId}/sso/${tenant.id}`
          })),
          ...globalSsoTenants.data.items
            .filter((gt: any) => !ssoTenants.data.items.some((t: any) => t.id === gt.id))
            .map((tenant: any) => ({
              data: [
                <>
                  {tenant.name}{' '}
                  <Badge color="blue" style={{ marginLeft: 8 }}>
                    Global
                  </Badge>
                </>,
                tenant.status,
                tenant.counts.connections,
                new Date(tenant.createdAt).toLocaleDateString('de-at'),
                <Button as="span" size="1">
                  View
                </Button>
              ],
              href: `/apps/${tenant.app.id}/sso/${tenant.id}`
            }))
        ]}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Access Groups
        </Title>

        <Link to={`/apps/${appId}/access-groups`}>
          <Button as="span" size="1">
            Manage
          </Button>
        </Link>
      </div>

      <Table
        headers={['Name', 'Rules', 'Created At', '']}
        data={accessGroups.data.items.map((group: any) => ({
          data: [
            group.name,
            group.counts.rules,
            new Date(group.createdAt).toLocaleDateString('de-at'),
            <Button as="span" size="1">
              View
            </Button>
          ],
          href: `/apps/${appId}/access-groups/${group.id}`
        }))}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          App Access Whitelist
        </Title>

        {accessGroups.data.items.length > 0 && (
          <Button
            size="1"
            onClick={() =>
              showModal(({ dialogProps, close }) => {
                let assign = useMutation(adminClient.accessGroup.assignToApp);
                let assignedIds = new Set(
                  appAssignments.data.map((a: any) => a.accessGroup.id)
                );
                let available = accessGroups.data.items.filter(
                  (g: any) => !assignedIds.has(g.id)
                );

                let form = useForm({
                  initialValues: { accessGroupId: available[0]?.id ?? '' },
                  onSubmit: async values => {
                    let [res] = await assign.mutate({
                      accessGroupId: values.accessGroupId,
                      appId: appId!
                    });
                    if (res) {
                      close();
                      appAssignmentsRoot.refetch();
                    }
                  },
                  schema: yup =>
                    yup.object({
                      accessGroupId: yup.string().required('Select an access group')
                    }) as any
                });

                return (
                  <Dialog.Wrapper {...dialogProps}>
                    <Dialog.Title>Assign Access Group to App</Dialog.Title>

                    {available.length === 0 ? (
                      <p style={{ color: '#888' }}>All access groups are already assigned.</p>
                    ) : (
                      <form onSubmit={form.handleSubmit}>
                        <Select
                          label="Access Group"
                          value={form.values.accessGroupId}
                          onChange={val => form.setFieldValue('accessGroupId', val)}
                          items={available.map((g: any) => ({ id: g.id, label: g.name }))}
                        />

                        <Button
                          type="submit"
                          loading={assign.isLoading}
                          success={assign.isSuccess}
                        >
                          Assign
                        </Button>
                        <assign.RenderError />
                      </form>
                    )}
                  </Dialog.Wrapper>
                );
              })
            }
          >
            Add
          </Button>
        )}
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        If no access groups are assigned, all users can access this app. Otherwise, users must
        match at least one assigned access group.
      </p>

      <Table
        headers={['Access Group', 'Rules', '']}
        data={appAssignments.data.map((assignment: any) => [
          assignment.accessGroup.name,
          assignment.accessGroup.counts.rules,
          <AppAssignmentActions
            assignment={assignment}
            onUpdate={() => appAssignmentsRoot.refetch()}
          />
        ])}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Surfaces
        </Title>
      </div>
    </>
  ));
};

let AppAssignmentActions = ({
  assignment,
  onUpdate
}: {
  assignment: any;
  onUpdate: () => void;
}) => {
  let unassign = useMutation(adminClient.accessGroup.unassign);

  return (
    <Button
      size="1"
      variant="outline"
      loading={unassign.isLoading}
      onClick={async () => {
        if (!confirm('Remove this access group from the app whitelist?')) return;
        await unassign.mutate({ assignmentId: assignment.id });
        onUpdate();
      }}
    >
      Remove
    </Button>
  );
};

let RedirectDomainsSection = ({ appId, app }: { appId: string; app: any }) => {
  let update = useMutation(adminClient.app.update);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Redirect Domains
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let addDomain = useMutation(adminClient.app.update);

              let form = useForm({
                initialValues: { domain: '' },
                onSubmit: async values => {
                  let [res] = await addDomain.mutate({
                    id: appId,
                    redirectDomains: [...(app.data.redirectDomains ?? []), values.domain]
                  });
                  if (res) {
                    close();
                    app.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    domain: yup.string().required('Domain is required')
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Add Redirect Domain</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Input
                      label="Domain"
                      placeholder="example.com or *.example.com"
                      {...form.getFieldProps('domain')}
                    />
                    <form.RenderError field="domain" />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={addDomain.isLoading}
                      success={addDomain.isSuccess}
                    >
                      Add
                    </Button>
                    <addDomain.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Add Domain
        </Button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        If empty, all redirect domains are allowed. Supports wildcard subdomains like
        *.example.com
      </p>

      <Table
        headers={['Domain', '']}
        data={(app.data.redirectDomains ?? []).map((domain: string) => [
          <Text size="2" style={{ fontFamily: 'monospace' }}>
            {domain}
          </Text>,
          <Button
            size="1"
            variant="outline"
            loading={update.isLoading}
            onClick={async () => {
              if (!confirm(`Remove "${domain}" from redirect domains?`)) return;
              await update.mutate({
                id: appId,
                redirectDomains: (app.data.redirectDomains ?? []).filter(
                  (d: string) => d !== domain
                )
              });
              app.refetch();
            }}
          >
            Remove
          </Button>
        ])}
      />
    </>
  );
};

let AppSettingsSection = ({ appId, app }: { appId: string; app: any }) => {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Authentication Settings
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let update = useMutation(adminClient.app.update);

              let form = useForm({
                initialValues: {
                  isSessionless: Boolean(app.data.isSessionless),
                  disableEmailAuth: Boolean(app.data.disableEmailAuth)
                },
                onSubmit: async values => {
                  let [res] = await update.mutate({
                    id: appId,
                    isSessionless: values.isSessionless,
                    disableEmailAuth: values.disableEmailAuth
                  });
                  if (res) {
                    close();
                    app.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    isSessionless: yup.boolean(),
                    disableEmailAuth: yup.boolean()
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Edit Authentication Settings</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Checkbox
                      checked={form.values.isSessionless}
                      onCheckedChange={e => form.setFieldValue('isSessionless', e)}
                      label="Sessionless app"
                    />

                    <Spacer size={15} />

                    <Checkbox
                      checked={form.values.disableEmailAuth}
                      onCheckedChange={e => form.setFieldValue('disableEmailAuth', e)}
                      label="Disable email authentication"
                    />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={update.isLoading}
                      success={update.isSuccess}
                    >
                      Save
                    </Button>
                    <update.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Edit
        </Button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        Control whether this app uses sessions and whether email-based sign-in is available.
      </p>
    </>
  );
};

let OAuthProviderActions = ({
  provider,
  onUpdate
}: {
  provider: any;
  onUpdate: () => void;
}) => {
  let toggleEnabled = useMutation(adminClient.oauthProvider.update);
  let deleteProvider = useMutation(adminClient.oauthProvider.delete);

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <Button
        size="1"
        variant="outline"
        loading={toggleEnabled.isLoading}
        onClick={async () => {
          await toggleEnabled.mutate({
            id: provider.id,
            enabled: !provider.enabled
          });
          onUpdate();
        }}
      >
        {provider.enabled ? 'Disable' : 'Enable'}
      </Button>

      <Button
        size="1"
        variant="outline"
        loading={deleteProvider.isLoading}
        onClick={async () => {
          if (!confirm('Delete this OAuth provider?')) return;
          await deleteProvider.mutate({ id: provider.id });
          onUpdate();
        }}
      >
        Delete
      </Button>
    </div>
  );
};
