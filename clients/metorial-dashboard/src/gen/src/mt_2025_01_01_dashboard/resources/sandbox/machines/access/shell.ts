import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesAccessShellOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapSandboxMachinesAccessShellOutput =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessShellOutput>(
    ['expires_at'],
    1
  );

export type SandboxMachinesAccessShellBody = {
  ttlSeconds?: number | undefined;
};

export let mapSandboxMachinesAccessShellBody =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessShellBody>(['ttl_seconds']);
