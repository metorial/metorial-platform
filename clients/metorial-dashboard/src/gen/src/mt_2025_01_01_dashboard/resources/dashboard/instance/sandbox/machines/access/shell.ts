import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesAccessShellOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
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
