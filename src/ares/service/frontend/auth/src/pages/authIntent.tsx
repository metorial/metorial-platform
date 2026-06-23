import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthIntentScene } from '../scenes/authIntent';

export let AuthIntent = () => {
  let [searchParams, setSearchParams] = useSearchParams();
  let authIntentId = searchParams.get('authIntentId');

  let [authIntentClientSecret, setAuthIntentClientSecret] = useState<string | null>(null);

  useEffect(() => {
    let hash = window.location.hash;
    let parsedHash = new URLSearchParams(hash.slice(1));
    let authIntentClientSecret = parsedHash.get('authIntentClientSecret');

    if (authIntentClientSecret) {
      setAuthIntentClientSecret(authIntentClientSecret);
    } else {
      authIntentClientSecret = searchParams.get('authIntentClientSecret');
      if (authIntentClientSecret) {
        setAuthIntentClientSecret(authIntentClientSecret);
        setSearchParams(m => {
          m.delete('authIntentClientSecret');
          return m;
        });
      }
    }

    // Clear the hash
    window.location.hash = '';
  }, []);

  return (
    <AuthIntentScene
      authIntentId={authIntentId ?? undefined}
      authIntentClientSecret={authIntentClientSecret ?? undefined}
    />
  );
};
