import { useMutation } from '@metorial-io/data-hooks';
import { Error } from '@metorial-io/ui';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';
import { authState } from '../state/auth';

export let Internal = () => {
  let [searchParams] = useSearchParams();
  let clientId = searchParams.get('client_id');

  if (!clientId) {
    return (
      <AuthLayout>
        <Error>Missing required parameter: client_id</Error>
      </AuthLayout>
    );
  }

  let auth = authState.use({ clientId });
  let startAuthentication = useMutation(auth.mutators.start);

  let authenticatingRef = useRef(false);

  useEffect(() => {
    if (authenticatingRef.current) return;

    let hash = window.location.hash;
    let parsedHash = new URLSearchParams(hash.slice(1));
    let token = parsedHash.get('token');

    if (token && auth.data?.defaultRedirectUrl) {
      authenticatingRef.current = true;

      startAuthentication.mutate({
        type: 'internal',
        clientId,
        token,
        redirectUrl: auth.data.defaultRedirectUrl
      });
    }

    // Clear the hash
    window.location.hash = '';
  }, [auth.data?.defaultRedirectUrl]);

  return null;
};
