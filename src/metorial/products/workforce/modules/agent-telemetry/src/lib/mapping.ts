import type {
  Consumer,
  ConsumerDevice,
  ConsumerProfile,
  InstanceConsumer,
  McpClientType,
  Organization
} from '@metorial/db';

export let consumerEntitySource = 'metorial.consumer';
export let deviceEntitySource = 'metorial.device';
export let clientEntitySource = 'metorial.client';

export let syncedEntitySources = {
  user: consumerEntitySource,
  device: deviceEntitySource
} as const;

export let archivableStatuses = ['managed', 'discovered'] as const;

export type EntityIdentifierInput = { type: string; value: string };

export let normalizeEmail = (email: string | null | undefined) => {
  let normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return undefined;

  return normalized;
};

let uniqueIdentifiers = (identifiers: EntityIdentifierInput[]) => [
  ...new Map(
    identifiers.map(identifier => [`${identifier.type}:${identifier.value}`, identifier])
  ).values()
];

export let consumerEntityInput = (d: {
  organization: Pick<Organization, 'id'>;
  consumer: Pick<Consumer, 'id' | 'name' | 'email' | 'isServiceAccount'> & {
    profiles: Pick<ConsumerProfile, 'id' | 'email' | 'status'>[];
    instanceConsumers: Pick<InstanceConsumer, 'email'>[];
  };
}) => {
  let profiles = d.consumer.profiles.filter(profile => profile.status == 'active');

  // Service accounts carry generated addresses that no person or vendor feed will ever report.
  let emails = d.consumer.isServiceAccount
    ? []
    : [
        d.consumer.email,
        ...profiles.map(profile => profile.email),
        ...d.consumer.instanceConsumers.map(instanceConsumer => instanceConsumer.email)
      ]
        .map(normalizeEmail)
        .filter((email): email is string => !!email);

  return {
    organizationId: d.organization.id,
    kind: 'user',
    source: consumerEntitySource,
    ref: d.consumer.id,
    name: d.consumer.name || undefined,
    attributes: d.consumer.isServiceAccount ? { type: 'service' } : {},
    identifiers: uniqueIdentifiers([
      ...emails.map(value => ({ type: 'email', value })),
      ...profiles.map(profile => ({ type: 'profile', value: profile.id }))
    ])
  };
};

export let deviceEntityInput = (d: {
  organization: Pick<Organization, 'id'>;
  consumerDevice: Pick<
    ConsumerDevice,
    'id' | 'name' | 'os' | 'arch' | 'appVersion' | 'installationId'
  >;
}) => ({
  organizationId: d.organization.id,
  kind: 'device',
  source: deviceEntitySource,
  ref: d.consumerDevice.id,
  name: d.consumerDevice.name,
  attributes: {
    os: d.consumerDevice.os,
    arch: d.consumerDevice.arch,
    appVersion: d.consumerDevice.appVersion
  },
  identifiers: [{ type: 'install:metorial', value: d.consumerDevice.installationId }]
});

export let clientAgentEntityInput = (d: {
  organization: Pick<Organization, 'id'>;
  client: { name: string; mcpClientType: Pick<McpClientType, 'key'> };
}) => ({
  organizationId: d.organization.id,
  kind: 'agent',
  source: clientEntitySource,
  ref: d.client.mcpClientType.key,
  name: d.client.name,
  attributes: {},
  identifiers: [{ type: 'client_family', value: d.client.mcpClientType.key }]
});
