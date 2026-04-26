import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Badge, Button, Flex, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  showProviderAuthMethodDetailsModal
} from '../../../scenes/providers/authMethodDetails';

export let ProviderDeploymentAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;

  let authMethods = useProviderAuthMethods(
    instance.data?.id,
    effectiveVersionId ? { providerVersionId: effectiveVersionId } : null
  );

  let authMethodsContent = renderWithPagination(authMethods)(authMethods => (
    <>
      <Table
        headers={['Name', 'Type', 'ID', '']}
        data={authMethods.data.items.map(method => {
          let description =
            method.description && method.description.length > 110
              ? `${method.description.slice(0, 110)}...`
              : (method.description ?? '');

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
              <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge color={getProviderAuthMethodTypeColor(method.type)} size="1">
                  {getProviderAuthMethodTypeLabel(method.type)}
                </Badge>
              </Flex>,
              <ID id={method.id} />,
              <Flex justify="end" style={{ width: '100%' }}>
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

      {authMethods.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No authentication methods found for this provider.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(() => authMethodsContent);
};
