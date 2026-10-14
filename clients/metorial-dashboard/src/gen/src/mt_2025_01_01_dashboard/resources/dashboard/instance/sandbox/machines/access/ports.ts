import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesAccessPortsOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapDashboardInstanceSandboxMachinesAccessPortsOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessPortsOutput>(
    ['expires_at'],
    1
  );

export type DashboardInstanceSandboxMachinesAccessPortsBody = {
  ports: number[] | '*';
  ttlSeconds?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesAccessPortsBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessPortsBody>([
    'ttl_seconds'
  ]);
