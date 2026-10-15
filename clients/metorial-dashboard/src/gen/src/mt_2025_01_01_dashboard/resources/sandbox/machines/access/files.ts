import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SandboxMachinesAccessFilesOutput = {
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
