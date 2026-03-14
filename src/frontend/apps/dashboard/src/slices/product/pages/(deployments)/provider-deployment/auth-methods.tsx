import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Badge, Button, Flex, Input, Text } from '@metorial/ui';
import { useState } from 'react';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  getProviderAuthMethodSchemaFieldCount,
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  hasProviderAuthMethodSchemaFields,
  showProviderAuthMethodDetailsModal
} from '../../../scenes/providers/authMethodDetails';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let [search, setSearch] = useState('');
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);

  return renderWithLoader({ instance, deployment, provider })(() => (
    <ProviderDeploymentTabSection
      intro="Auth methods define how this deployment can be connected and authorized."
      search={
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search auth methods..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      }
    >
      {!effectiveVersionId ? (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          {provider.data?.type?.auth?.status === 'enabled'
            ? 'No provider version is available yet, so auth methods cannot be loaded.'
            : 'This deployment does not require authentication.'}
        </Text>
      ) : (
        <ProviderDeploymentAuthMethodsList authMethods={authMethods} search={search} />
      )}
    </ProviderDeploymentTabSection>
  ));
};

let ProviderDeploymentAuthMethodsList = ({
  authMethods,
  search
}: {
  authMethods: ReturnType<typeof useProviderAuthMethods>;
  search: string;
}) => {
  return renderWithPagination(authMethods)(authMethods => {
    let normalizedSearch = search.trim().toLowerCase();
    let methods = authMethods.data.items.filter(method => {
      if (!normalizedSearch) return true;

      return [method.name, method.description ?? '', getProviderAuthMethodTypeLabel(method.type)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return (
      <>
        <Table
          headers={['Name', 'Type', 'Details', 'Action']}
          data={methods.map(method => {
            let description =
              method.description && method.description.length > 110
                ? `${method.description.slice(0, 110)}...`
                : (method.description ?? '');
            let hasInputFields = hasProviderAuthMethodSchemaFields(method.inputSchema);
            let hasOutputFields = hasProviderAuthMethodSchemaFields(method.outputSchema);
            let scopeCount = method.type === 'oauth' ? (method.scopes?.length ?? 0) : 0;

            return {
              data: [
                <Flex direction="column" gap={2}>
                  <Text size="2" weight="strong">
                    {method.name}
                  </Text>
                  <Text
                    size="2"
                    color="gray600"
                    style={{
                      display: 'block',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {description}
                  </Text>
                </Flex>,
                <Badge color={getProviderAuthMethodTypeColor(method.type)} size="1">
                  {getProviderAuthMethodTypeLabel(method.type)}
                </Badge>,
                <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  {scopeCount > 0 ? (
                    <Badge color="gray" size="1">
                      {scopeCount} Scopes
                    </Badge>
                  ) : null}
                  {hasInputFields ? (
                    <Badge color="cyan" size="1">
                      {getProviderAuthMethodSchemaFieldCount(method.inputSchema)} Input Fields
                    </Badge>
                  ) : null}
                  {hasOutputFields ? (
                    <Badge color="purple" size="1">
                      {getProviderAuthMethodSchemaFieldCount(method.outputSchema)} Output Fields
                    </Badge>
                  ) : null}
                  {scopeCount === 0 && !hasInputFields && !hasOutputFields ? (
                    <Text size="2" color="gray600">
                      -
                    </Text>
                  ) : null}
                </Flex>,
                <Flex style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button
                    size="1"
                    variant="outline"
                    onClick={() => showProviderAuthMethodDetailsModal(method)}
                  >
                    View Details
                  </Button>
                </Flex>
              ]
            };
          })}
        />

        {methods.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No auth methods for this deployment.
          </Text>
        )}
      </>
    );
  });
};
