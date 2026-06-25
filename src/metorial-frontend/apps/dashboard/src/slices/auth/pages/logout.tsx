import { getConfig } from '@metorial/frontend-config';
import { useEffect, useRef } from 'react';
import { useLogout } from '../state';

export let AuthLogoutPage = () => {
  let logout = useLogout();
  let pendingRef = useRef(false);

  useEffect(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    logout.mutate({}).then(() => {
      pendingRef.current = false;
      window.location.href = getConfig().auth.loginPath;
    });
  }, []);

  return null;
};
