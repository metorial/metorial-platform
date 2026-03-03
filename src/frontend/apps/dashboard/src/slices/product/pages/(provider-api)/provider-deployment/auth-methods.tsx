import { DashboardInstanceProvidersAuthMethodsListOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { AccordionSingle, Badge, Button, Flex, Spacer, Text } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import {
  getJsonSchema,
  hasJsonSchemaProperties,
  type JsonSchemaEnvelope
} from '../../../lib/jsonSchema';
import { showProviderAuthConfigFormModal } from '../../../scenes/providerAuthConfigs/modal';
import { showProviderAuthCredentialsFormModal } from '../../../scenes/providerAuthCredentials/modal';
import { showProviderSetupSessionModal } from '../../../scenes/providerDeployments/setupSessionModal';

type ProviderAuthMethod = DashboardInstanceProvidersAuthMethodsListOutput['items'][number];

export let ProviderDeploymentAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);

  return renderWithLoader({ instance, deployment, provider })(({ instance, deployment, provider }) =>
    renderWithPagination(authMethods)(authMethods => (
      <>
        {authMethods.data.items.length === 0 && (
          <Text size="2" color="gray600" align="center">
            No auth methods found.
          </Text>
        )}

        <Flex direction="column" gap={6}>
          {authMethods.data.items.map((method: ProviderAuthMethod) => {
            let inputSchema = getJsonSchema(
              method.inputSchema as JsonSchemaEnvelope | Record<string, unknown> | null
            );
            let hasRequiredFields = hasJsonSchemaProperties(
              method.inputSchema as JsonSchemaEnvelope | Record<string, unknown> | null
            );
            let schemaProperties =
              inputSchema &&
              typeof inputSchema === 'object' &&
              'properties' in inputSchema &&
              inputSchema.properties &&
              typeof inputSchema.properties === 'object'
                ? Object.entries(inputSchema.properties as Record<string, { description?: string }>)
                : [];
            let isOAuth = method.type === 'oauth';

            return (
              <AccordionSingle
                key={method.id}
                title={
                  <Flex gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge color={isOAuth ? 'blue' : method.type === 'token' ? 'green' : 'gray'}>
                      {method.type === 'oauth'
                        ? 'OAuth'
                        : method.type.charAt(0).toUpperCase() + method.type.slice(1)}
                    </Badge>
                    <Text size="2" weight="strong">
                      {method.name}
                    </Text>
                    {isOAuth && (
                      <Badge color="gray" size="1">
                        {method.scopes?.length ?? 0} Scopes
                      </Badge>
                    )}
                  </Flex>
                }
              >
                <Flex direction="column" gap={12}>
                  {method.description && (
                    <Text size="2" color="gray600">
                      {method.description}
                    </Text>
                  )}

                  {isOAuth && (method.scopes?.length ?? 0) > 0 && (
                    <div>
                      <Text size="2" weight="strong">
                        Requested Scopes
                      </Text>
                      <Spacer size={6} />
                      <Flex direction="column" gap={4}>
                        {(method.scopes ?? []).map(scope => (
                          <Text key={scope.id} size="1" color="gray600">
                            {scope.description ?? scope.name ?? scope.scope}
                          </Text>
                        ))}
                      </Flex>
                    </div>
                  )}

                  {hasRequiredFields && schemaProperties.length > 0 && (
                    <div>
                      <Text size="2" weight="strong">
                        Required Fields
                      </Text>
                      <Spacer size={6} />
                      <Flex direction="column" gap={4}>
                        {schemaProperties.map(([name, property]) => (
                          <Text key={name} size="1" color="gray600">
                            <strong>{name}</strong>
                            {property.description ? ` · ${property.description}` : ''}
                          </Text>
                        ))}
                      </Flex>
                    </div>
                  )}

                  <Flex gap={10} wrap="wrap">
                    <Button
                      size="2"
                      onClick={() =>
                        showProviderAuthConfigFormModal({
                          type: 'create',
                          instanceId: instance.data.id,
                          providerDeploymentId: deployment.data.id
                        })
                      }
                    >
                      Create Auth Config
                    </Button>

                    {isOAuth && (
                      <Button
                        size="2"
                        variant="outline"
                        onClick={() =>
                          showProviderAuthCredentialsFormModal({
                            instanceId: instance.data.id,
                            providerId: provider.data.id,
                            deploymentId: deployment.data.id
                          })
                        }
                      >
                        Create Credentials
                      </Button>
                    )}

                    {isOAuth && (
                      <Button
                        size="2"
                        variant="outline"
                        onClick={() =>
                          showProviderSetupSessionModal({
                            instanceId: instance.data.id,
                            providerId: provider.data.id,
                            deploymentId: deployment.data.id
                          })
                        }
                      >
                        Connect
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </AccordionSingle>
            );
          })}
        </Flex>
      </>
    ))
  );
};
