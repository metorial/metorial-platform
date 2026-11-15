import { useMutation } from '@metorial-io/data-hooks';
import { useEffect, useState } from 'react';
import { adminClient } from '../../state/client';

export let AuthCallbackPage = () => {
  let [error, setError] = useState<string | null>(null);
  let mutation = useMutation(adminClient.authentication.exchangeCode);

  useEffect(() => {
    let code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setError('Missing authorization code');
      return;
    }

    mutation.mutate({ code }).then(([res, err]) => {
      if (res) {
        window.location.replace('/users');
      } else {
        setError(err?.message ?? 'Authentication failed');
      }
    });
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}
    >
      {error ? (
        <div style={{ textAlign: 'center' }}>
          <p>{error}</p>
          <a href="/login">Try again</a>
        </div>
      ) : (
        <p>Authenticating...</p>
      )}
    </div>
  );
};
