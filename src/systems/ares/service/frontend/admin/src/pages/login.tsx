import { useEffect } from 'react';
import { preload } from '../lib/preload';

export let LoginPage = () => {
  useEffect(() => {
    let redirectUri = `${preload.adminUrl}/auth/callback`;
    let url = `${preload.authUrl}/login?client_id=__admin__&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.replace(url);
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
      <p>Redirecting to login...</p>
    </div>
  );
};
