import { useEffect, useRef } from 'react';
import { useBoot } from '../state/portal/client';

export let Redirect = ({ to }: { to: string }) => {
  let boot = useBoot();

  let navigatingRef = useRef(false);
  useEffect(() => {
    if (navigatingRef.current || !boot.data) return;
    navigatingRef.current = true;
    window.location.replace(`${boot.data.portalUrl}${to}`);
  }, [to, boot.data]);
  return null;
};
