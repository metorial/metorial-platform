import type { ErrorData } from '@lowerdeck/error';
import {
  type AdapterActionKey,
  type AdapterCapabilityKey,
  type InferClient,
  isAdapterActionAvailable,
  isAdapterCapabilityAvailable,
  type SlateAdapterAdvertisedCapability,
  type SlateAdapterDefinition
} from '@slates/adapter';
import type { Environment, Session, SessionConnection, SessionMessage, Tenant } from '@metorial-subspace/db';
import {
  internalToolCallService,
  type InternalToolCallClient
} from '@metorial-subspace/module-session';
import { loadAdvertisedAdapterCapabilities } from './capabilities';

export type AdapterClientParams = {
  tenant: Tenant;
  environment: Environment;
  session: Session;
  client: InternalToolCallClient;
};

export type AdapterClientCreateParams<T extends SlateAdapterDefinition<any, any, any>> =
  AdapterClientParams & {
    adapter: T;
  };

export type AdapterCallFailureOutput =
  | ErrorData<any, any>
  | { code: number | string; message: string };

export type AdapterCallResult<Output> = {
  result:
    | { type: 'success'; output: Output }
    | { type: 'failure'; output: AdapterCallFailureOutput };
  message: SessionMessage;
  connection: SessionConnection;
};

export class AdapterClient<T extends SlateAdapterDefinition<any, any, any>> {
  private constructor(
    private readonly adapter: T,
    private readonly tenant: Tenant,
    private readonly environment: Environment,
    private readonly session: Session,
    private readonly toolCallClient: InternalToolCallClient,
    private readonly advertised: SlateAdapterAdvertisedCapability[]
  ) {}

  static async create<T extends SlateAdapterDefinition<any, any, any>>(
    params: AdapterClientCreateParams<T>
  ) {
    let advertised = await loadAdvertisedAdapterCapabilities({
      session: params.session,
      adapterId: params.adapter.id
    });

    return new AdapterClient(
      params.adapter,
      params.tenant,
      params.environment,
      params.session,
      params.client,
      advertised
    );
  }

  async call<K extends keyof InferClient<T>['tools'] & string>(
    method: K,
    input: InferClient<T>['tools'][K]['input']
  ): Promise<AdapterCallResult<InferClient<T>['tools'][K]['output']>> {
    let response = await internalToolCallService.call({
      tenant: this.tenant,
      environment: this.environment,
      session: this.session,
      adapter: { identifier: this.adapter.id },
      client: this.toolCallClient,
      key: method,
      input: input as Record<string, any>
    });

    if (response.result.status === 'success') {
      return {
        result: {
          type: 'success',
          output: response.result.output as InferClient<T>['tools'][K]['output']
        },
        message: response.message,
        connection: response.connection
      };
    }

    return {
      result: {
        type: 'failure',
        output: (response.result.output ?? {
          code: 'tool_call_failed',
          message: 'Tool call failed'
        }) as AdapterCallFailureOutput
      },
      message: response.message,
      connection: response.connection
    };
  }

  isActionAvailable(action: AdapterActionKey<T>) {
    return isAdapterActionAvailable(this.adapter, this.advertised, action);
  }

  isCapabilityAvailable(capability: AdapterCapabilityKey<T>) {
    return isAdapterCapabilityAvailable(this.adapter, this.advertised, capability);
  }
}
