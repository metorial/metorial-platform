import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesAccessFilesOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapSandboxMachinesAccessFilesOutput =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessFilesOutput>(
    ['expires_at'],
    1
  );

export type SandboxMachinesAccessFilesBody = {
  ttlSeconds?: number | undefined;
};

export let mapSandboxMachinesAccessFilesBody =
  /* @__PURE__ */ mapObject<SandboxMachinesAccessFilesBody>(['ttl_seconds']);
