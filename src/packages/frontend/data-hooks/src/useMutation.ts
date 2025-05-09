import { ServiceError, internalServerError, isServiceError } from '@metorial/error';
import { getSentry } from '@metorial/sentry';
import { Error } from '@metorial/ui';
import { isMetorialSDKError } from '@metorial/util-endpoint';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

let Sentry = getSentry();

export let useMutation = <Input, Response>(
  mutator: ((i: Input) => Promise<Response>) | undefined,
  opts?: {
    disableToast?: boolean;
  }
) => {
  let [loading, setLoading] = useState(false);
  let [error, setError] = useState<ServiceError<any> | null>(null);
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
      // Sentry.captureException(error);

      setLoading(false);

      let serviceError = isServiceError(err)
        ? err
        : isMetorialSDKError(err)
          ? ServiceError.fromResponse(err.response)
          : new ServiceError(
              internalServerError({
                message:
                  'An error occurred while processing your request. Please try again later.'
              })
            );

      setError(serviceError as any as ServiceError<any>);
      if (!opts?.disableToast) toast.error(serviceError.data.message);
      // Sentry.captureException(err);

      return [null, serviceError] as [null, ServiceError<any>];
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

    error: error?.data,
    data: data as Awaited<Response>,
    input,

    RenderError: () => {
      if (!error) return null;

      return React.createElement(Error, {
        style: { marginTop: 6 },
        size: 12,
        children: error.data.message
      });
    }
  };
};
