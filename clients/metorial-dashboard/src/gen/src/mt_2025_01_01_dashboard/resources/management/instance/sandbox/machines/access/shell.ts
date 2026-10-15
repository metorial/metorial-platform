import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSandboxMachinesAccessShellOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: {
    type: 'shell' | 'files' | 'port';
    shell: string | null;
    files: string | null;
    ports: Record<string, string> | null;
  };
  expiresAt: Date;
};

export let mapManagementInstanceSandboxMachinesAccessShellOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessShellOutput>(
    ['expires_at'],
    1
  );

export type ManagementInstanceSandboxMachinesAccessShellBody = {
  ttlSeconds?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesAccessShellBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSandboxMachinesAccessShellBody>([
    'ttl_seconds'
  ]);
