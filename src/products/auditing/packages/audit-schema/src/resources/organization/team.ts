import { v } from '@lowerdeck/validation';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  Organization,
  Project,
  Team,
  TeamProject
} from '@metorial/db';
import { teamPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let teamResource = resource({
  name: 'team',
  payload: v.typedAny<{
    team: Team & {
      organization: Organization;
      projects: (TeamProject & { project: Project })[];
      policies?: (AccessPolicyAssignment & {
        accessPolicy: AccessPolicy;
      })[];
    };
  }>('team'),
  presenter: teamPresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let teamMemberResource = resource({
  name: 'team_member',
  payload: v.typedAny<{
    team: { id: string; name: string; slug: string };
    actor: { id: string; name: string; email: string | null };
    member: { id: string };
  }>('team_member'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
