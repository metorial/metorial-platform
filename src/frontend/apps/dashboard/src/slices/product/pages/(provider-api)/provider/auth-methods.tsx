import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderAuthMethods } from '@metorial/state';
import { Badge, Button, Flex, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import {
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  showProviderAuthMethodDetailsModal
} from '../../../scenes/providers/authMethodDetails';
import { useProviderVersionContext } from './_layout';

export let ProviderAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId } = useProviderVersionContext();
  let authMethods = useProviderAuthMethods(instance.data?.id, selectedVersionId);

  let authMethodsContent = renderWithPagination(authMethods)(authMethods => (
    <>
      <Table
        headers={['Name', 'Type', '']}
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

      {authMethods.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No authentication methods found for this provider.
        </Text>
      )}
    </>
  ));

  return renderWithLoader({ instance })(() => authMethodsContent);
};
