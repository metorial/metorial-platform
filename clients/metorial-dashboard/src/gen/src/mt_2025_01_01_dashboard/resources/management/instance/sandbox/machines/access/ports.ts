import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSandboxMachinesAccessPortsOutput = {
  object: 'sandbox.machine.access';
  token: string;
  scope: 'shell' | 'files' | 'port';
  ports: number[] | '*' | null;
  urls: { shell: string; files: string; ports: Record<string, string> };
  expiresAt: Date;
};

export let mapManagementInstanceSandboxMachinesAccessPortsOutput =
  mtMap.object<ManagementInstanceSandboxMachinesAccessPortsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    token: mtMap.objectField('token', mtMap.passthrough()),
    scope: mtMap.objectField('scope', mtMap.passthrough()),
    ports: mtMap.objectField(
      'ports',
      mtMap.union([
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('number', mtMap.passthrough())])
        )
      ])
    ),
    urls: mtMap.objectField(
      'urls',
      mtMap.object({
        shell: mtMap.objectField('shell', mtMap.passthrough()),
        files: mtMap.objectField('files', mtMap.passthrough()),
        ports: mtMap.objectField('ports', mtMap.passthrough())
      })
    ),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceSandboxMachinesAccessPortsBody = {
  ports: number[] | '*';
  ttlSeconds?: number | undefined;
};

export let mapManagementInstanceSandboxMachinesAccessPortsBody =
  mtMap.object<ManagementInstanceSandboxMachinesAccessPortsBody>({
    ports: mtMap.objectField(
      'ports',
      mtMap.union([
        mtMap.unionOption(
          'array',
          mtMap.union([mtMap.unionOption('number', mtMap.passthrough())])
        )
      ])
    ),
    ttlSeconds: mtMap.objectField('ttl_seconds', mtMap.passthrough())
  });

