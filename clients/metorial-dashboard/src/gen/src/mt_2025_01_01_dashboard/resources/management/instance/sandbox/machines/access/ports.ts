import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesAccessPortsOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapManagementInstanceSandboxMachinesAccessPortsOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessPortsOutput>(
    ['expires_at'],
    1
  );

export type ManagementInstanceSandboxMachinesAccessPortsBody = {
  ports: number[] | '*';
  ttlSeconds?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesAccessPortsBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessPortsBody>([
    'ttl_seconds'
  ]);
