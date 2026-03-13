import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentity
} from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';

export let IdentityPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { identityId } = useParams();
  let identity = useIdentity(instance.data?.id, identityId);

  return renderWithLoader({ identity, organization, project, instance })(
    ({ identity, organization, project, instance }) => (
      <>
        <Attributes
          itemWidth="240px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={identity.data.id} />
            },
            {
              label: 'Owner',
              content: (
                <Link
                  to={Paths.instance.identity.actor(
                    organization.data,
                    project.data,
                    instance.data,
                    identity.data.owner.actor.id
                  )}
                >
                  {identity.data.owner.actor.name}
                </Link>
              )
            },
            {
              label: 'Owner Actor ID',
              content: <ID id={identity.data.owner.actor.id} />
            },
            {
              label: 'Status',
              content: identity.data.status
            },
            {
              label: 'Credentials',
              content: identity.data.credentials.length
            },
            {
              label: 'Delegation Config ID',
              content: identity.data.delegationConfigId ? (
                <ID id={identity.data.delegationConfigId} />
              ) : (
                'Default'
              )
            },
            {
              label: 'Created At',
              content: <RenderDate date={identity.data.createdAt} />
            },
            {
              label: 'Updated At',
              content: <RenderDate date={identity.data.updatedAt} />
            }
          ]}
        />

        <Spacer size={20} />

        <Box title="Credentials" description="Credentials attached to this identity.">
          <Table
            headers={[
              'Credential ID',
              'Provider',
              'Deployment',
              'Config',
              'Auth Config',
              'Delegation Config'
            ]}
            data={identity.data.credentials.map(credential => ({
              data: [
                <ID id={credential.id} />,
                credential.providerId,
                credential.deploymentId ? (
                  <Link
                    to={Paths.instance.providerDeployment(
                      organization.data,
                      project.data,
                      instance.data,
                      credential.deploymentId
                    )}
                  >
                    <ID id={credential.deploymentId} />
                  </Link>
                ) : (
                  '—'
                ),
                credential.deploymentId && credential.configId ? (
                  <Link
                    to={Paths.instance.providerConfig(
                      organization.data,
                      project.data,
                      instance.data,
                      credential.deploymentId,
                      credential.configId
                    )}
                  >
                    <ID id={credential.configId} />
                  </Link>
                ) : (
                  '—'
                ),
                credential.deploymentId && credential.authConfigId ? (
                  <Link
                    to={Paths.instance.providerAuthConfig(
                      organization.data,
                      project.data,
                      instance.data,
                      credential.deploymentId,
                      credential.authConfigId
                    )}
                  >
                    <ID id={credential.authConfigId} />
                  </Link>
                ) : (
                  '—'
                ),
                credential.delegationConfigId ? (
                  <Link
                    to={Paths.instance.identity.delegationConfig(
                      organization.data,
                      project.data,
                      instance.data,
                      credential.delegationConfigId
                    )}
                  >
                    <ID id={credential.delegationConfigId} />
                  </Link>
                ) : (
                  '—'
                )
              ]
            }))}
          />

          {identity.data.credentials.length === 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No credentials attached to this identity.
            </Text>
          )}
        </Box>
      </>
    )
  );
};
