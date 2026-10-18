import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let sandboxMachineAuditResource = resource({
  name: 'sandbox_machine',
  payload: v.typedAny<{
    id: string;
    name: string | null;
    imageId: string | null;
    regionIdentifier: string | null;
    specMemoryMiB: number | null;
    specVcpus: number | null;
  }>('sandbox_machine'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true,
    start: true,
    pause: true,
    hibernate: true,
    restart: true
  }
});

export let sandboxMachineAccessAuditResource = resource({
  name: 'sandbox_machine_access',
  payload: v.typedAny<{
    machineId: string;
    machineName: string | null;
    kind: 'shell' | 'files' | 'port';
    ports: number[] | '*' | null;
    ttlSeconds: number | null;
  }>('sandbox_machine_access'),
  presenter: undefined,
  actions: {
    create: true
  }
});
