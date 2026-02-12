import { CodeBlock } from '@metorial/code';
// Type removed in Provider API migration
type ProviderConnectionData = { id: string; name: string | null; [key: string]: unknown };
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnectionProfile } from '@metorial/state';
import { Attributes, RenderDate, Spacer, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';

export let ProviderConnectionProfile = ({
  profileId,
  providerConnection
}: {
  profileId: string;
  providerConnection: ProviderConnectionData | undefined | null;
}) => {
  let instance = useCurrentInstance();
  let profile = useProviderConnectionProfile(
    instance.data?.instanceId,
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
            content: <ID id={profile.data.sub ?? undefined} />
          },
          { label: 'Last Used At', content: profile.data.lastUsedAt ? <RenderDate date={profile.data.lastUsedAt} /> : 'Never' },
          { label: 'Created At', content: <RenderDate date={profile.data.createdAt} /> }
        ]}
      />

      <Spacer height={15} />

      <CodeBlock language="json" code={JSON.stringify(profile.data, null, 2)} />
    </>
  ));
};
