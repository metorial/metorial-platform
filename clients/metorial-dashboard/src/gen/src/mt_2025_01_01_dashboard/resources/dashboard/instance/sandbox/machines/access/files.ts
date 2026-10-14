import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSandboxMachinesAccessFilesOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapDashboardInstanceSandboxMachinesAccessFilesOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessFilesOutput>(
    ['expires_at'],
    1
  );

export type DashboardInstanceSandboxMachinesAccessFilesBody = {
  ttlSeconds?: number | undefined;
};

export let mapDashboardInstanceSandboxMachinesAccessFilesBody =
  /* @__PURE__ */ mapObject<DashboardInstanceSandboxMachinesAccessFilesBody>([
    'ttl_seconds'
  ]);
