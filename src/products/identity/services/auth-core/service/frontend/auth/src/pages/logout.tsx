import { useEffect, useRef } from 'react';
import { authClient } from '../state/client';

export let Logout = () => {
  let isLoggingOutRef = useRef(false);

  useEffect(() => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    authClient.session.logout(undefined).then(r => {
      window.location.replace(r.url);
    });
  }, []);

  return null;
};
