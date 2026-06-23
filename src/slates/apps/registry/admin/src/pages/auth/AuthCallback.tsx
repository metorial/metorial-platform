import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminClient } from '../../hooks/client';

export let AuthCallback = () => {
  let [searchParams] = useSearchParams();
  let navigate = useNavigate();
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received');
      return;
    }

    adminClient.auth
      .exchangeCode({ code })
      .then(() => {
        navigate('/', { replace: true });
      })
      .catch(err => {
        setError(err.message || 'Failed to authenticate');
      });
  }, [searchParams, navigate]);

  if (error) {
    return <div>Authentication error: {error}</div>;
  }

  return <div>Authenticating...</div>;
};
