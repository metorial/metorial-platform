import { CodeBlock } from '@metorial/code';
import { DashboardInstanceProviderOauthConnectionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnectionProfile } from '@metorial/state';
import { Attributes, RenderDate, Spacer, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';

export let ProviderConnectionProfile = ({
  profileId,
  providerConnection
}: {
  profileId: string;
  providerConnection: DashboardInstanceProviderOauthConnectionsGetOutput | undefined | null;
}) => {
  let instance = useCurrentInstance();
  let profile = useProviderConnectionProfile(
    instance.data?.id,
    providerConnection?.id ?? profileId,
    profileId
  );

  return renderWithLoader({ profile })(({ profile }) => (
    <>
      <Attributes
        attributes={[
          { label: 'Profile ID', content: <ID id={profile.data.id} /> },
          {
            label: 'Name',
            content: profile.data.name ?? (
              <span style={{ color: theme.colors.gray600 }}>Untitled</span>
            )
          },
          {
            label: 'Email',
            content: profile.data.email ?? (
              <span style={{ color: theme.colors.gray600 }}>No email provided</span>
            )
          },
          {
            label: 'Subject',
            content: <ID id={profile.data.sub} />
          },
          { label: 'Last Used At', content: <RenderDate date={profile.data.lastUsedAt} /> },
          { label: 'Created At', content: <RenderDate date={profile.data.createdAt} /> }
        ]}
      />

      <Spacer height={15} />

      <CodeBlock language="json" code={JSON.stringify(profile.data, null, 2)} />
    </>
  ));
};
