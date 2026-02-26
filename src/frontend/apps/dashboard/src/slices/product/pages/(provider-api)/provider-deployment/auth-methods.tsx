import { renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthMethods,
  useProviderDeployment
} from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderDeploymentAuthMethodsPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let provider = useProvider(instance.data?.id, deployment.data?.providerId);
  let effectiveVersionId =
    deployment.data?.lockedVersion?.id ?? provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(instance.data?.id, effectiveVersionId);

  return renderWithPagination(authMethods)(authMethods => (
    <>
      <Table
        headers={['Name', 'Type', 'ID', 'Description']}
        data={authMethods.data.items.map(method => ({
          data: [
            <Text size="2" weight="strong">
              {method.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
            </Text>,
            <Text size="2">{method.type}</Text>,
            <ID id={method.id} />,
            <Text size="2" color="gray600">
              {method.description?.slice(0, 80)}
              {(method.description?.length ?? 0) > 80 ? '...' : ''}
            </Text>
          ]
        }))}
      />

      {authMethods.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth methods found.
        </Text>
      )}
    </>
  ));
};
