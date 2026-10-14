import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesAccessPortsOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapSandboxMachinesAccessPortsOutput =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessPortsOutput>(
    ['expires_at'],
    1
  );

export type SandboxMachinesAccessPortsBody = {
  ports: number[] | '*';
  ttlSeconds?: number | undefined;
};

export let mapSandboxMachinesAccessPortsBody =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessPortsBody>(['ttl_seconds']);
