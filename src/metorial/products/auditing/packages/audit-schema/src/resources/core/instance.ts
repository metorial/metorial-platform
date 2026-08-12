import { v } from '@lowerdeck/validation';
import { Instance, Organization, Project, Sandbox } from '@metorial/db';
import { instancePresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let instanceResource = resource({
  name: 'instance',
  payload: v.typedAny<{
    instance: Instance & {
      project: Project;
      organization: Organization;
      sandbox?: Sandbox | null;
    };
  }>('instance'),
  presenter: instancePresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
