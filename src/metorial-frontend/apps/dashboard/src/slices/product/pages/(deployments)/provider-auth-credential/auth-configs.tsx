import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigs
} from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '—';
};

export let ProviderAuthCredentialAuthConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerAuthCredentialsId } = useParams();

  let authConfigs = useProviderAuthConfigs(instance.data?.id, {
    providerAuthCredentialsId
  });

  return renderWithPagination(authConfigs)(authConfigs => (
    <>
      <Table
        headers={['Name', 'Type', 'Auth Method', 'Created']}
        data={authConfigs.data.items.map(config => ({
          href: Paths.instance.providerAuthConfig(
            organization.data,
            project.data,
            instance.data,
            config.id
          ),
          data: [
            <Text size="2" weight="strong">
              {config.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
            </Text>,
            <Text size="2">{formatType(config.type)}</Text>,
            <Text size="2">{config.authMethod?.name ?? config.authMethod?.key ?? '—'}</Text>,
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {authConfigs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth configs are using this credential.
        </Text>
      )}
    </>
  ));
};
