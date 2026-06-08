import type { PrismaClient } from '../../../prisma/generated/client';
import { RegistryFixtures } from './registryFixtures';
import { SlateFixtures } from './slateFixtures';
import { SlateVersionFixtures } from './slateVersionFixtures';
import { SlateSpecificationFixtures } from './slateSpecificationFixtures';
import { TenantFixtures } from './tenantFixtures';
import { DeploymentProviderFixtures, SlateDeploymentFixtures } from './deploymentFixtures';
import {
  SlateConfigSchemaFixtures,
  SlateInstanceFixtures,
  SlateInstanceConfigFixtures
} from './instanceFixtures';
import {
  SlateInvocationStorageBucketFixtures,
  SlateInvocationFixtures
} from './invocationFixtures';
import { SecretFixtures } from './secretFixtures';
import { SlateSessionFixtures } from './slateSessionFixtures';
import { SlateEventFixtures } from './slateEventFixtures';
import { ChangeNotificationFixtures } from './changeNotificationFixtures';
import { SlateSpecificationChangeFixtures } from './slateSpecificationChangeFixtures';
import { SlateVersionDiscoveryFixtures } from './slateVersionDiscoveryFixtures';
import { SlateAuthMethodFixtures } from './slateAuthMethodFixtures';
import { SlateOAuthCredentialsFixtures } from './slateOAuthCredentialsFixtures';
import { SlateAuthConfigFixtures } from './slateAuthConfigFixtures';
import { SlateOAuthSetupFixtures } from './slateOAuthSetupFixtures';
import { SlateTriggerReceiverFixtures } from './slateTriggerReceiverFixtures';
import { SlateTriggerEventFixtures } from './slateTriggerEventFixtures';
import { SlateTriggerInvocationFixtures } from './slateTriggerInvocationFixtures';
import { SlateSessionToolCallFixtures } from './slateSessionToolCallFixtures';

export function fixtures(db: PrismaClient) {
  return {
    registry: RegistryFixtures(db),
    slate: SlateFixtures(db),
    slateVersion: SlateVersionFixtures(db),
    slateSpecification: SlateSpecificationFixtures(db),
    tenant: TenantFixtures(db),
    deploymentProvider: DeploymentProviderFixtures(db),
    slateDeployment: SlateDeploymentFixtures(db),
    slateConfigSchema: SlateConfigSchemaFixtures(db),
    slateInstance: SlateInstanceFixtures(db),
    slateInstanceConfig: SlateInstanceConfigFixtures(db),
    storageBucket: SlateInvocationStorageBucketFixtures(db),
    slateInvocation: SlateInvocationFixtures(db),
    secret: SecretFixtures(db),
    slateSession: SlateSessionFixtures(db),
    slateEvent: SlateEventFixtures(db),
    changeNotification: ChangeNotificationFixtures(db),
    slateSpecificationChange: SlateSpecificationChangeFixtures(db),
    slateVersionDiscovery: SlateVersionDiscoveryFixtures(db),
    slateAuthMethod: SlateAuthMethodFixtures(db),
    slateOAuthCredentials: SlateOAuthCredentialsFixtures(db),
    slateAuthConfig: SlateAuthConfigFixtures(db),
    slateOAuthSetup: SlateOAuthSetupFixtures(db),
    slateTriggerReceiver: SlateTriggerReceiverFixtures(db),
    slateTriggerEvent: SlateTriggerEventFixtures(db),
    slateTriggerInvocation: SlateTriggerInvocationFixtures(db),
    slateSessionToolCall: SlateSessionToolCallFixtures(db)
  };
}

export {
  RegistryFixtures,
  SlateFixtures,
  SlateVersionFixtures,
  SlateSpecificationFixtures,
  TenantFixtures,
  DeploymentProviderFixtures,
  SlateDeploymentFixtures,
  SlateConfigSchemaFixtures,
  SlateInstanceFixtures,
  SlateInstanceConfigFixtures,
  SlateInvocationStorageBucketFixtures,
  SlateInvocationFixtures,
  SecretFixtures,
  SlateSessionFixtures,
  SlateEventFixtures,
  ChangeNotificationFixtures,
  SlateSpecificationChangeFixtures,
  SlateVersionDiscoveryFixtures,
  SlateAuthMethodFixtures,
  SlateOAuthCredentialsFixtures,
  SlateAuthConfigFixtures,
  SlateOAuthSetupFixtures,
  SlateTriggerReceiverFixtures,
  SlateTriggerEventFixtures,
  SlateTriggerInvocationFixtures,
  SlateSessionToolCallFixtures
};
