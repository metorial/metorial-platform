import { v } from '@lowerdeck/validation';
import { Organization, Project } from '@metorial/db';
import { projectPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let projectResource = resource({
  name: 'project',
  payload: v.typedAny<{ project: Project & { organization: Organization } }>('project'),
  presenter: projectPresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
