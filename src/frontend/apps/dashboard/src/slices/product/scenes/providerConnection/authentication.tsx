import { CodeBlock } from '@metorial/code';
import { DashboardInstanceProviderOauthConnectionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnectionAuthentication } from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';

export let ProviderConnectionAuthentication = ({
  authenticationId,
  providerConnection
}: {
  authenticationId: string;
  providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput | undefined | null;
}) => {
  let instance = useCurrentInstance();
  let authentication = useProviderConnectionAuthentication(
    instance.data?.id,
    providerConnection?.id ?? authenticationId,
    authenticationId
  );

  return renderWithLoader({ authentication })(({ authentication }) => (
    <>
      <Attributes
        attributes={[
          { label: 'Authentication ID', content: <ID id={authentication.data.id} /> },
          { label: 'Status', content: authentication.data.status },
          {
            label: 'Profile',
            content: authentication.data.profile ? (
              (authentication.data.profile.email ??
              authentication.data.profile.name ?? <ID id={authentication.data.profile.sub} />)
            ) : (
              <span style={{ color: theme.colors.gray600 }}>No profile linked</span>
            )
          }
        ]}
      />

      <Spacer height={15} />

      <Box title="Events" description="Events related to this authentication">
        <Table
          headers={['Type', 'Message', 'Created']}
          data={authentication.data.events.map(event => ({
            data: [
              {
                authentication_completed: 'Authenticated',
                authentication_error: 'Authentication error',
                provider_token_disabled_error: 'Token disabled'
              }[event.type] ?? event.type,
              event.type == 'authentication_completed'
                ? 'The user has successfully authenticated'
                : event.metadata.error_message,
              <RenderDate date={event.createdAt} />
            ]
          }))}
        />

        {authentication.data.events.length == 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No events recorded for this authentication.
          </Text>
        )}
      </Box>

      <Spacer height={15} />

      <CodeBlock language="json" code={JSON.stringify(authentication.data, null, 2)} />
    </>
  ));
};
