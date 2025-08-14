import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderConnection,
  useProviderConnectionAuthentication
} from '@metorial/state';
import { Callout, Spacer } from '@metorial/ui';
import { useParams, useSearchParams } from 'react-router-dom';
import { ProviderConnectionAuthentication } from '../../../scenes/providerConnection/authentication';

export let ProviderConnectionTestResponsePage = () => {
  let instance = useCurrentInstance();

  let { providerConnectionId } = useParams();
  let [search] = useSearchParams();
  let authAttemptId = search.get('metorial_auth_attempt_id');

  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);
  let authorization = useProviderConnectionAuthentication(
    instance.data?.id,
    providerConnection.data?.id ?? providerConnectionId,
    authAttemptId
  );

  return renderWithLoader({ providerConnection, authorization })(
    ({ providerConnection, authorization }) => (
      <>
        <Callout color="green">
          <span>
            <strong>Connection Test Successful!</strong> Metorial was able to successfully
            authenticate with the provider.
          </span>
        </Callout>

        <Spacer height={15} />

        <ProviderConnectionAuthentication
          authenticationId={authorization.data.id}
          providerConnection={providerConnection.data}
        />
      </>
    )
  );
};
