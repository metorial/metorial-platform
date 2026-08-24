import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import type {
  SlatesAction as ProtoSlatesAction,
  SlateAuthenticationMethod,
  SlatesMessageProviderIdentifyResponse,
  SlatesTriggerGroup
} from '@slates/proto';
import { PrismaClient } from '../prisma/generated/client';

let mainAdapter = new PrismaPg({
  connectionString: process.env.SLATES_HUB_DATABASE_URL ?? process.env.DATABASE_URL
});

let replicaAdapter = process.env.DATABASE_URL_READER
  ? new PrismaPg({
      connectionString: process.env.DATABASE_URL_READER
    })
  : undefined;

let replicaClient = replicaAdapter ? new PrismaClient({ adapter: replicaAdapter }) : undefined;

let baseClient = new PrismaClient({
  adapter: mainAdapter,
  transactionOptions: {
    maxWait: 10000,
    timeout: 12000
  }
});

if (replicaClient) {
  baseClient = baseClient.$extends(
    readReplicas({ replicas: [replicaClient] })
  ) as any as PrismaClient;
}

export let db = baseClient;

declare global {
  namespace PrismaJson {
    type PortRange = {
      from: number;
      to: number;
    };

    type CompiledNetworkAllowEntry = {
      cidr: string;
      portRange?: PortRange;
    };

    type CompiledNetworkAllowList = {
      direction: 'ingress' | 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    type CompiledEgressNetworkAllowList = {
      direction: 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    interface SlateJson {
      name: string;
      version: string;
      description?: string;
      timeout?: number;
    }

    type SlateDeploymentProviderDeploymentInfo = {
      functionId: string;
      functionVersionId?: string;
      functionDeploymentId: string;
    } | null;

    type SlateConfigSchema = any;

    type SlateDocReference = {
      type?: string;
      name: string;
      url: string;
    };
    type SlateDocReferences = SlateDocReference[];

    type SlateAuthMethod = SlateAuthenticationMethod;
    type SlateAction = ProtoSlatesAction;
    type SlateTriggerGroup = SlatesTriggerGroup;

    type SlateAuthMethods = SlateAuthenticationMethod[];
    type SlateActions = ProtoSlatesAction[];
    type SlateTriggerGroups = SlatesTriggerGroup[];

    type AnyRecord = Record<string, any>;

    type SlateProviderInfo = SlatesMessageProviderIdentifyResponse['result']['provider'];

    type AuthProfile = {
      id?: string;
      email?: string;
      name?: string;
      imageUrl?: string;
      [key: string]: any;
    };
  }
}
