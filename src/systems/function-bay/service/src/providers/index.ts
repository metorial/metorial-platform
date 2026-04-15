import { notFoundError, ServiceError } from '@lowerdeck/error';
import { env } from '../env';
import { awsLambda } from './aws-lambda';

export let providers = [awsLambda];
export let defaultProvider = providers.find(
  p => p.identifier == env.provider.DEFAULT_PROVIDER
)!;

let providerMap = new Map(
  providers.flatMap(
    p =>
      [
        [p.provider.id, p],
        [p.provider.oid, p]
      ] as [string | bigint, typeof p][]
  )
);

export let getProvider = (id: string | bigint) => {
  let provider = providerMap.get(id);
  if (!provider) throw new ServiceError(notFoundError('provider'));
  return provider;
};
