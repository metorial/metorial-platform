import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesAccessShellOutput = {
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

export let mapDashboardInstanceSandboxMachinesAccessShellOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessShellOutput>(
    ['expires_at'],
    1
  );

export type DashboardInstanceSandboxMachinesAccessShellBody = {
  ttlSeconds?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesAccessShellBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessShellBody>([
    'ttl_seconds'
  ]);
