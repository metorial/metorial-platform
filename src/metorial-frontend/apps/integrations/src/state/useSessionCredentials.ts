import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { SessionCredentials } from './types';

export let useSessionCredentials = (): SessionCredentials | null => {
  let { sessionId } = useParams();
  let [searchParams] = useSearchParams();
  let clientSecret = searchParams.get('client_secret');

  return useMemo(
    () => (sessionId && clientSecret ? { sessionId, clientSecret } : null),
    [sessionId, clientSecret]
  );
};
