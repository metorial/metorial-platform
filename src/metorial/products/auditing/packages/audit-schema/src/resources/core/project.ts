import { v } from '@lowerdeck/validation';
import { Organization, Project } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let projectResource = resource({
  name: 'project',
  payload: v.typedAny<Project & { organization: Organization }>('project'),
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
