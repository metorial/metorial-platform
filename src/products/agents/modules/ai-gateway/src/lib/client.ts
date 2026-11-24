import { isServiceError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { createAiGatewayClient } from '@mtsrc/ai-gateway-client-internal';
import { aiGatewaySettings } from '../env';

export type AiGateway = ReturnType<typeof createAiGatewayClient>;

type Output<F extends (...args: any[]) => any> = Awaited<ReturnType<F>>;

// Every instance-scoped gateway call takes the core organization and instance ids as refs.
export type AiGatewayInput<F extends (input: any) => any> = Omit<
  Parameters<F>[0],
  'organizationId' | 'instanceId'
>;

type PageItem<F extends (...args: any[]) => Promise<{ items: any[] }>> =
  Output<F>['items'][number];

export type AiGatewayInstance = Output<AiGateway['instance']['get']>;

export type AiGatewayProject = Output<AiGateway['project']['get']>;

export type AiGatewayToken = Output<AiGateway['gatewayToken']['get']>;

export type AiGatewayProviderConnection = Output<AiGateway['providerConnection']['get']>;

export type AiGatewayVirtualModel = Output<AiGateway['virtualModel']['get']>;

export type AiGatewayVirtualModelVersion = Output<AiGateway['virtualModel']['getVersion']>;

export type AiGatewayVirtualModelTemplate = PageItem<AiGateway['virtualModel']['listTemplates']>;

export type AiGatewayInferenceLog = Output<AiGateway['inferenceLog']['get']>;

export type AiGatewayLab = PageItem<AiGateway['catalog']['listLabs']>;

export type AiGatewayCatalogProvider = PageItem<AiGateway['catalog']['listProviders']>;

export type AiGatewayModel = Output<AiGateway['catalog']['getModel']>;

export type AiGatewayModelOffering = PageItem<AiGateway['catalog']['listOfferings']>;

let client: AiGateway | undefined;

export let isAiGatewayEnabled = () => !!aiGatewaySettings.apiUrl;

export let getAiGateway = () => {
  let endpoint = aiGatewaySettings.apiUrl;
  if (!endpoint) return null;

  client ??= createAiGatewayClient({ endpoint });

  return client;
};

export let requireAiGateway = () => {
  let gateway = getAiGateway();
  if (!gateway) {
    throw new ServiceError(
      preconditionFailedError({ message: 'The AI gateway is not configured.' })
    );
  }

  return gateway;
};

// Archiving something the gateway no longer has (or already archived) is the goal state.
export let ignoreNotFound = async <T>(promise: Promise<T>) => {
  try {
    return await promise;
  } catch (error) {
    if (isServiceError(error) && error.data.status == 404) return null;
    throw error;
  }
};
