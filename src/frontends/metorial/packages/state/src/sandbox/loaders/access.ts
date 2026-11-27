import type {
  DashboardInstanceSandboxMachinesAccessPortsOutput,
  DashboardInstanceSandboxMachinesAccessShellOutput
} from '@metorial/dashboard-sdk';
import { useMutation } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export type SandboxMachineAccessScope = 'shell' | 'files' | 'ports';

export type SandboxMachineAccessInput = {
  instanceId: string;
  machineId: string;
  ttlSeconds?: number;
} & (
  | { scope: 'shell' }
  | { scope: 'files' }
  | {
      scope: 'ports';
      ports: number[] | '*';
      port?: number;
    }
);

export type SandboxMachineAccess = {
  url: string;
  token: string;
  expiresAt: Date;
  scope: DashboardInstanceSandboxMachinesAccessShellOutput['scope'];
  ports: DashboardInstanceSandboxMachinesAccessPortsOutput['ports'];
  urls: DashboardInstanceSandboxMachinesAccessShellOutput['urls'];
};

let requestAccess = (input: SandboxMachineAccessInput) =>
  withAuth(sdk => {
    let { instanceId, machineId, ttlSeconds } = input;

    if (input.scope == 'shell') {
      return sdk.sandbox.machines.access.shell(instanceId, machineId, { ttlSeconds });
    }

    if (input.scope == 'files') {
      return sdk.sandbox.machines.access.files(instanceId, machineId, { ttlSeconds });
    }

    return sdk.sandbox.machines.access.ports(instanceId, machineId, {
      ports: input.ports,
      ttlSeconds
    });
  });

let resolveUrl = (input: SandboxMachineAccessInput, urls: SandboxMachineAccess['urls']) => {
  if (input.scope == 'shell') return urls.shell ?? '';
  if (input.scope == 'files') return urls.files ?? '';

  let port = input.port ?? (Array.isArray(input.ports) ? input.ports[0] : undefined);

  return port === undefined ? '' : (urls.ports?.[String(port)] ?? '');
};

export let createSandboxMachineAccess = async (
  input: SandboxMachineAccessInput
): Promise<SandboxMachineAccess> => {
  let access = await requestAccess(input);

  return {
    url: resolveUrl(input, access.urls),
    token: access.token,
    expiresAt: access.expiresAt,
    scope: access.scope,
    ports: access.ports,
    urls: access.urls
  };
};

export let useCreateSandboxMachineAccess = () =>
  useMutation((input: SandboxMachineAccessInput) => createSandboxMachineAccess(input));
