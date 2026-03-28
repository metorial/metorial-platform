import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthCredentials,
  useProviderDeployment
} from '@metorial/state';
import { Button, Flex, Input, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { showProviderAuthCredentialsFormModal } from '../../../scenes/providerAuthCredentials/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentAuthCredentialsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let { search, setSearch, searchQuery } = useSearchFilter();

  let authCredentials = useProviderAuthCredentials(instance.data?.id, {
    search: searchQuery,
    providerId: deployment.data?.providerId
  });

  return renderWithLoader({ instance, organization, project, deployment })(
    ({ instance, organization, project, deployment }) => (
      <ProviderDeploymentTabSection
        intro="Auth credentials store reusable OAuth app credentials for this deployment's provider."
        actions={
          <Button
            size="2"
            onClick={() =>
              showProviderAuthCredentialsFormModal({
                instanceId: instance.data.id,
                providerId: deployment.data.providerId,
                deploymentId: deployment.data.id,
                onCreate: credential =>
                  navigate(
                    Paths.instance.providerAuthCredential(
                      organization.data,
                      project.data,
                      instance.data,
                      credential.id
                    )
                  )
              })
            }
          >
            Create Auth Credentials
          </Button>
        }
        search={
          <Input
            label="Search"
            hideLabel
            size="2"
            placeholder="Search auth credentials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        }
      >
        {renderWithPagination(authCredentials)(authCredentials => (
          <>
            <Table
              headers={['Name', 'ID', 'Type', 'Created']}
              data={authCredentials.data.items.map(credential => ({
                href: Paths.instance.providerAuthCredential(
                  organization.data,
                  project.data,
                  instance.data,
                  credential.id
                ),
                data: [
                  <Flex direction="column" gap={6}>
                    <Text size="2" weight="strong">
                      {credential.name || '—'}
                    </Text>
                    {(credential.isDefault || credential.isManaged) && (
                      <Text size="2" color="gray600">
                        {[
                          credential.isDefault ? 'Default' : null,
                          credential.isManaged ? 'Managed by Metorial' : null
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    )}
                  </Flex>,
                  <ID id={credential.id} />,
                  <Text size="2">{credential.type}</Text>,
                  credential.createdAt ? (
                    <RenderDate date={credential.createdAt} />
                  ) : (
                    <Text size="2" color="gray600">
                      —
                    </Text>
                  )
                ]
              }))}
            />

            {authCredentials.data.items.length === 0 && (
              <>
                <Spacer size={10} />
                <Text size="2" color="gray600" align="center">
                  No auth credentials found for this deployment's provider.
                </Text>
              </>
            )}
          </>
        ))}
      </ProviderDeploymentTabSection>
    )
  );
};
