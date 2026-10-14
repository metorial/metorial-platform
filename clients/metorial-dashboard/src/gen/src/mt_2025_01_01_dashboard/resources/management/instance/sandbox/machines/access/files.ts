import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesAccessFilesOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapManagementInstanceSandboxMachinesAccessFilesOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessFilesOutput>(
    ['expires_at'],
    1
  );

export type ManagementInstanceSandboxMachinesAccessFilesBody = {
  ttlSeconds?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesAccessFilesBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessFilesBody>([
    'ttl_seconds'
  ]);
