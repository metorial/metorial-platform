import { Prisma, type Tenant } from '../../prisma/generated/client';

export type HubTransaction = Prisma.TransactionClient;

export let receiverBinding = async (
  tx: HubTransaction,
  tenant: Tenant,
  receiverId: string
) => {
  let receiver = await tx.slateTriggerReceiver.findFirst({
    where: { id: receiverId, tenantOid: tenant.oid },
    include: { slateInstance: true }
  });
  if (!receiver || receiver.slateInstance.tenantOid !== tenant.oid) {
    throw new Error('Receiver secret owner binding is invalid');
  }
  return receiver;
};

export let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export let findDeclaredRegistrationSecret = (
  value: unknown,
  name: string
): { name: string; registrationKey: string; encoding: string } | null => {
  if (Array.isArray(value)) {
    for (let item of value) {
      let found = findDeclaredRegistrationSecret(item, name);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (
    value.source === 'registration' &&
    value.name === name &&
    typeof value.registrationKey === 'string' &&
    typeof value.encoding === 'string'
  ) {
    return {
      name,
      registrationKey: value.registrationKey,
      encoding: value.encoding
    };
  }
  for (let child of Object.values(value)) {
    let found = findDeclaredRegistrationSecret(child, name);
    if (found) return found;
  }
  return null;
};

export type DeclaredTriggerSecretRef = {
  name: string;
  source: 'registration' | 'config' | 'platform' | 'generated';
  encoding: string;
  registrationKey?: string;
  configKey?: string;
  credentialKey?: string;
};
export let findDeclaredTriggerSecretRef = (
  value: unknown,
  name: string
): DeclaredTriggerSecretRef | null => {
  if (Array.isArray(value)) {
    for (let item of value) {
      let found = findDeclaredTriggerSecretRef(item, name);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (
    value.name === name &&
    ['registration', 'config', 'platform', 'generated'].includes(String(value.source)) &&
    typeof value.encoding === 'string'
  ) {
    return {
      name,
      source: value.source as DeclaredTriggerSecretRef['source'],
      encoding: value.encoding,
      ...(typeof value.registrationKey === 'string'
        ? { registrationKey: value.registrationKey }
        : {}),
      ...(typeof value.configKey === 'string' ? { configKey: value.configKey } : {}),
      ...(typeof value.credentialKey === 'string'
        ? { credentialKey: value.credentialKey }
        : {})
    };
  }
  for (let child of Object.values(value)) {
    let found = findDeclaredTriggerSecretRef(child, name);
    if (found) return found;
  }
  return null;
};

export let collectDeclaredConfigSecretRefs = (
  value: unknown,
  result = new Map<string, DeclaredTriggerSecretRef>()
) => {
  if (Array.isArray(value)) {
    value.forEach(item => collectDeclaredConfigSecretRefs(item, result));
  } else if (isRecord(value)) {
    if (
      value.source === 'config' &&
      typeof value.name === 'string' &&
      typeof value.configKey === 'string' &&
      typeof value.encoding === 'string'
    ) {
      result.set(value.name, {
        name: value.name,
        source: 'config',
        configKey: value.configKey,
        encoding: value.encoding
      });
    }
    Object.values(value).forEach(child => collectDeclaredConfigSecretRefs(child, result));
  }
  return [...result.values()];
};
