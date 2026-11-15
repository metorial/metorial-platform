import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let outpostInstanceResource = resource({
  name: 'outpost_instance',
  payload: v.typedAny<{
    id: string;
    status: string;
    outpostId: string;
    name: string;
    services?: { service: string; version: string | null; granted: boolean }[];
    keyRotationCount: number;
    registrationCount: number;
    expiresAt: Date | null;
    deleted?: { events: number; keyRotations: number };
  }>('outpost_instance'),
  presenter: undefined,
  actions: {
    register: true,
    rotate_key: true,
    deactivate: true,
    prune: true,
    delete: true
  }
});
