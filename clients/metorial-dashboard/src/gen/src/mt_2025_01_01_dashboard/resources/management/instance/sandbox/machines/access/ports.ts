import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesAccessPortsOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: {
    type: 'shell' | 'files' | 'port';
    shell: string | null;
    exec: string | null;
    files: string | null;
    ports: Record<string, string> | null;
  };
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
