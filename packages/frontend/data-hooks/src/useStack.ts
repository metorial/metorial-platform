import { ServiceError } from '@metorial/error';

export let useStack = (
  ..._loaders: (
    | {
        error: ServiceError<any> | null | undefined;
        isLoading: boolean;
        refetch?: () => any;
      }
    | undefined
  )[]
) => {
  let loaders = _loaders.filter(Boolean) as {
    error: ServiceError<any> | null | undefined;
    isLoading: boolean;
    refetch?: () => any;
  }[];

  let isLoading = loaders.some(loader => loader.isLoading);
  let error = loaders.find(loader => loader.error)?.error;

  return {
    isLoading: error ? false : isLoading,
    error,
    refetch: () => loaders.forEach(loader => loader.refetch?.())
  };
};
