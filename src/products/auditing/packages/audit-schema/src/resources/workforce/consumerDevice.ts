import { v } from '@lowerdeck/validation';
import type { ConsumerDeviceStatus } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let consumerDeviceAuditResource = resource({
  name: 'consumer_device',
  payload: v.typedAny<{
    id: string;
    consumerProfileId: string;
    consumerProfileEmail: string;
    name: string;
    os: string;
    arch: string;
    appVersion: string;
    status: ConsumerDeviceStatus;
    clients: {
      key: string;
      enabled: boolean;
      excludedMagicMcpServerCount: number;
      excludedSkillCount: number;
    }[];
    revokedAt: Date | null;
  }>('consumer_device'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
