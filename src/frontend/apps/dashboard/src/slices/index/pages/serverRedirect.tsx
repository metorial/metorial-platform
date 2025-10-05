import { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

export let ServerRedirect = () => {
  let { serverId } = useParams();

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!serverId || navigatedRef.current) return;
    navigatedRef.current = true;
    location.replace(`/?path=${encodeURIComponent(`/server/${serverId}`)}`);
  }, [serverId]);

  return null;
};
