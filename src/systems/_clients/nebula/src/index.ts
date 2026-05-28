import { createClient } from '@lowerdeck/rpc-client';
import type { NebulaClient } from '../../../nebula/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

type SecretClient = NebulaClient['secret'];
type SecretCreateInput = Parameters<SecretClient['create']>[0];
type SecretUpdateInput = Parameters<SecretClient['update']>[0];
type SecretUseInput = Parameters<SecretClient['use']>[0];
type SecretDisableInput = Parameters<SecretClient['disable']>[0];

type WithInjectedConsumerToken<T> = Omit<T, 'consumerToken'>;

export type AuthenticatedNebulaClient = Omit<NebulaClient, 'secret'> & {
  secret: Omit<SecretClient, 'create' | 'update' | 'use' | 'disable'> & {
    create: (
      input: WithInjectedConsumerToken<SecretCreateInput>
    ) => ReturnType<SecretClient['create']>;
    update: (
      input: WithInjectedConsumerToken<SecretUpdateInput>
    ) => ReturnType<SecretClient['update']>;
    use: (input: WithInjectedConsumerToken<SecretUseInput>) => ReturnType<SecretClient['use']>;
    disable: (
      input: WithInjectedConsumerToken<SecretDisableInput>
    ) => ReturnType<SecretClient['disable']>;
  };
};

export type NebulaClientOpts = ClientOpts & {
  consumerToken: string;
  identifier: string;
  refreshSkewMs?: number;
};

type ConsumerInstanceToken = {
  token: string;
  consumerInstanceId: string;
  expiresAt: Date | string;
};

let toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export let createRawNebulaClient = (o: ClientOpts): NebulaClient =>
  createClient<NebulaClient>(o);

export let createNebulaClient = (o: NebulaClientOpts): AuthenticatedNebulaClient => {
  let { consumerToken, identifier, refreshSkewMs = 60_000, ...clientOpts } = o;
  let client = createRawNebulaClient(clientOpts);
  let current: ConsumerInstanceToken | null = null;
  let inFlight: Promise<ConsumerInstanceToken> | null = null;

  let register = async () => {
    let next = await client.consumer.register({
      secret: consumerToken,
      identifier
    });
    current = next;
    return next;
  };

  let refresh = async () => {
    if (!current) return await register();

    try {
      let next = await client.consumer.refresh({
        secret: consumerToken,
        token: current.token
      });
      current = next;
      return next;
    } catch {
      return await register();
    }
  };

  let getToken = async () => {
    if (current && toDate(current.expiresAt).getTime() - refreshSkewMs > Date.now()) {
      return current.token;
    }

    inFlight ??= refresh().finally(() => {
      inFlight = null;
    });

    return (await inFlight).token;
  };

  return {
    tenant: client.tenant,
    consumer: client.consumer,
    keyProvider: client.keyProvider,
    keyProviderError: client.keyProviderError,
    secret: {
      list: client.secret.list,
      get: client.secret.get,
      listVersions: client.secret.listVersions,
      create: async input =>
        await client.secret.create({
          ...input,
          consumerToken: await getToken()
        }),
      update: async input =>
        await client.secret.update({
          ...input,
          consumerToken: await getToken()
        }),
      use: async input =>
        await client.secret.use({
          ...input,
          consumerToken: await getToken()
        }),
      disable: async input =>
        await client.secret.disable({
          ...input,
          consumerToken: await getToken()
        })
    }
  };
};
