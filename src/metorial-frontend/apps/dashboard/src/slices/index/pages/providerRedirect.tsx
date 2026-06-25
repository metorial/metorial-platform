import { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

export let ProviderRedirect = () => {
  let { providerId } = useParams();

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!providerId || navigatedRef.current) return;
    navigatedRef.current = true;
    location.replace(`/?path=${encodeURIComponent(`/provider/${providerId}`)}`);
  }, [providerId]);

  return null;
};
