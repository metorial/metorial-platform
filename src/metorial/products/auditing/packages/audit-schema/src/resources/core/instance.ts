import { v } from '@lowerdeck/validation';
import { Instance, Organization, Project } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let instanceResource = resource({
  name: 'instance',
  payload: v.typedAny<Instance & { project: Project; organization: Organization }>('instance'),
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
