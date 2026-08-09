import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentity,
  useIdentityDelegationConfig,
  useIdentityDelegationConfigs,
  useProviderAuthConfigs,
  useProviderConfigs,
  useProviderDeployments,
  useProviders
} from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';
import { showAddIdentityCredentialModal } from '../../../scenes/identity/credentialModal';
import { UsageScene } from '../../../scenes/usage/usage';

let nonNullableUnique = <T,>(value: (T | null | undefined)[]): T[] =>
  Array.from(new Set(value.filter((v): v is T => v !== null && v !== undefined)));

let mapToIdFilter = (ids: string[]) => {
  if (ids.length === 0) return { id: ['__none__'], limit: 1 };
  return { id: ids, limit: 100 };
};

export let IdentityPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identityPaths = useIdentityPaths();
  let { identityId } = useParams();
  let _identity = useIdentity(instance.data?.id, identityId);
  let credentials = _identity.data?.credentials ?? [];

  let delegationConfig = useIdentityDelegationConfig(
    instance.data?.id,
    _identity.data?.delegationConfigId
  );
  let providerIds = useMemo(
    () => nonNullableUnique(credentials.map(credential => credential.providerId)),
    [credentials]
  );
  let deploymentIds = useMemo(
    () => nonNullableUnique(credentials.map(credential => credential.deploymentId)),
    [credentials]
  );
  let configIds = useMemo(
    () => nonNullableUnique(credentials.map(credential => credential.configId)),
    [credentials]
  );
  let authConfigIds = useMemo(
    () =>
      nonNullableUnique(
        credentials
          .map(credential => credential.authConfigId)
          .filter((value): value is string => !!value)
      ),
    [credentials]
  );
  let credentialDelegationConfigIds = useMemo(
    () =>
      Array.from(
        new Set(
          credentials
            .map(credential => credential.delegationConfigId)
            .filter((value): value is string => !!value)
        )
      ),
    [credentials]
  );
  let providers = useProviders(instance.data?.id, { id: providerIds });
  let deployments = useProviderDeployments(instance.data?.id, mapToIdFilter(deploymentIds));
  let configs = useProviderConfigs(instance.data?.id, mapToIdFilter(configIds));
  let authConfigs = useProviderAuthConfigs(instance.data?.id, mapToIdFilter(authConfigIds));
  let credentialDelegationConfigs = useIdentityDelegationConfigs(
    instance.data?.id,
    mapToIdFilter(credentialDelegationConfigIds)
  );

  return renderWithLoader({ identity: _identity, organization, project, instance })(
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
                  to={identityPaths.actor(
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
              label: 'Delegation Config ID',
              content: identity.data.delegationConfigId ? (
                // <ID id={identity.data.delegationConfigId} />
                <Link
                  to={Paths.organization.instance.identity.delegationConfig(
                    organization.data,
                    project.data,
                    instance.data,
                    identity.data.delegationConfigId
                  )}
                >
                  {delegationConfig.data?.name ?? '...'}
                </Link>
              ) : (
                'Default'
              )
            },
            {
              label: 'Created At',
              content: <RenderDate date={identity.data.createdAt} />
            }
          ]}
        />

        <Spacer size={20} />

        <UsageScene
          title="Usage"
          description="See how this identity is being used across delegations and requests."
          entities={[{ type: 'identity', id: identity.data.id }]}
          entityNames={{ [identity.data.id]: identity.data.name ?? identity.data.id }}
        />

        <Spacer size={20} />

        {renderWithLoader({
          providers,
          deployments,
          configs,
          authConfigs,
          credentialDelegationConfigs
        })(() => {
          let providerNameLookup = Object.fromEntries(
            (providers.data?.items ?? []).map(provider => [
              provider.id,
              provider.name ?? provider.id
            ])
          );
          let deploymentNameLookup = Object.fromEntries(
            (deployments.data?.items ?? []).map(deployment => [
              deployment.id,
              deployment.name ?? deployment.id
            ])
          );
          let configNameLookup = Object.fromEntries(
            (configs.data?.items ?? []).map(config => [config.id, config.name ?? config.id])
          );
          let authConfigNameLookup = Object.fromEntries(
            (authConfigs.data?.items ?? []).map(config => [
              config.id,
              config.name ?? config.id
            ])
          );
          let credentialDelegationConfigNameLookup = Object.fromEntries(
            (credentialDelegationConfigs.data?.items ?? []).map(config => [
              config.id,
              config.name ?? config.id
            ])
          );

          return (
            <Box
              title="Credentials"
              description="Credentials attached to this identity."
              rightActions={
                <Button
                  size="2"
                  onClick={() =>
                    showAddIdentityCredentialModal({
                      instanceId: instance.data.id,
                      identityId: identity.data.id,
                      onComplete: () => _identity.refetch()
                    })
                  }
                >
                  Add Credential
                </Button>
              }
            >
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
                    providerNameLookup[credential.providerId] ?? credential.providerId,
                    credential.deploymentId ? (
                      <Link
                        to={Paths.organization.instance.providerDeployment(
                          organization.data,
                          project.data,
                          instance.data,
                          credential.deploymentId
                        )}
                      >
                        {deploymentNameLookup[credential.deploymentId] ??
                          credential.deploymentId}
                      </Link>
                    ) : (
                      '—'
                    ),
                    credential.configId ? (
                      <Link
                        to={Paths.organization.instance.providerConfig(
                          organization.data,
                          project.data,
                          instance.data,
                          credential.configId
                        )}
                      >
                        {configNameLookup[credential.configId] ?? credential.configId}
                      </Link>
                    ) : (
                      '—'
                    ),
                    credential.authConfigId ? (
                      <Link
                        to={Paths.organization.instance.providerAuthConfig(
                          organization.data,
                          project.data,
                          instance.data,
                          credential.authConfigId
                        )}
                      >
                        {authConfigNameLookup[credential.authConfigId] ??
                          credential.authConfigId}
                      </Link>
                    ) : (
                      '—'
                    ),
                    credential.delegationConfigId ? (
                      <Link
                        to={Paths.organization.instance.identity.delegationConfig(
                          organization.data,
                          project.data,
                          instance.data,
                          credential.delegationConfigId
                        )}
                      >
                        {credentialDelegationConfigNameLookup[credential.delegationConfigId] ??
                          credential.delegationConfigId}
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
          );
        })}
      </>
    )
  );
};
