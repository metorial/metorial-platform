import { MetorialSDKError, isMetorialSDKError } from '@metorial/util-endpoint';
import React, { useEffect, useRef, useState } from 'react';
import { onError, toast } from '../handlers';

export let useMutation = <Input, Response>(
  mutator: ((i: Input) => Promise<Response>) | undefined,
  opts?: {
    disableToast?: boolean;
  }
) => {
  let [loading, setLoading] = useState(false);
  let [error, setError] = useState<MetorialSDKError | null>(null);
  let [data, setData] = useState<Response | null>(null);
  let [input, setInput] = useState<Input | null>(null);
  let [success, setSuccess] = useState(false);

  let mutate = async (input: Input) => {
    if (!mutator) return [null, null] as [null, null];

    setLoading(true);
    setError(null);
    setInput(input);

    try {
      let res = await mutator(input);
      setData(res);
      setLoading(false);
      setSuccess(true);

      return [res, null] as [Awaited<Awaited<Response>>, null];
    } catch (err: any) {
      onError(err);

      setLoading(false);

      let serviceError = isMetorialSDKError(err)
        ? err
        : new MetorialSDKError({
            status: 0,
            code: 'unknown',
            message: 'An unknown error occurred'
          });

      setError(serviceError as any as MetorialSDKError);
      if (!opts?.disableToast)
        toast('error', serviceError.validationErrors?.[0]?.message ?? serviceError.message);

      return [null, serviceError] as [null, MetorialSDKError];
    }
  };

  let successToRef = useRef<any>(undefined);
  useEffect(() => {
    if (!success) return;
    successToRef.current = setTimeout(() => setSuccess(false), 2500);
    return () => clearTimeout(successToRef.current);
  }, [success]);

  let [successPermanent, setSuccessPermanent] = useState(false);
  useEffect(() => {
    if (success) setSuccessPermanent(true);
  }, [success]);

  let [loadingPermanent, setLoadingPermanent] = useState(false);
  useEffect(() => {
    if (loading) setLoadingPermanent(true);
  }, [loading]);

  return {
    mutate,
    isLoading: loading,
    isSuccess: success,

    isSuccessPermanent: successPermanent,
    isLoadingPermanent: loadingPermanent,

    error: error,
    data: data as Awaited<Response>,
    input,

    RenderError: ({
      component
    }: {
      component: ({ children }: { children: string }) => any;
    }) => {
      if (!error) return null;

      return React.createElement(component, {
        children: error.validationErrors?.[0]?.message ?? error.message
      }) as any;
    }
  };
};
