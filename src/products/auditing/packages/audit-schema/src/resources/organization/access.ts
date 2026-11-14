import { v } from '@lowerdeck/validation';
import {
  AccessPolicy,
  AccessPolicyInstance,
  AccessPolicyProject,
  AccessPolicyRole,
  AccessRole,
  Instance,
  Organization,
  Project
} from '@metorial/db';
import { accessPolicyPresenter, accessRolePresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let accessRoleResource = resource({
  name: 'access_role',
  payload: v.typedAny<{
    accessRole: AccessRole & {
      organization: Organization;
    };
  }>('access_role'),
  presenter: accessRolePresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let accessPolicyResource = resource({
  name: 'access_policy',
  payload: v.typedAny<{
    accessPolicy: AccessPolicy & {
      organization: Organization;
      accessPolicyRoles: (AccessPolicyRole & {
        accessRole: AccessRole;
      })[];
      accessPolicyProjects: (AccessPolicyProject & {
        project: Project;
      })[];
      accessPolicyInstances: (AccessPolicyInstance & {
        instance: Instance & {
          project: Project;
          organization: Organization;
        };
      })[];
    };
  }>('access_policy'),
  presenter: accessPolicyPresenter,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let accessPolicyAssignmentResource = resource({
  name: 'access_policy_assignment',
  payload: v.typedAny<{
    assignment: { id: string };
    accessPolicy: { id: string; name: string; slug: string };
    team?: { id: string; name: string };
    member?: { id: string };
    serviceAccount?: { id: string };
  }>('access_policy_assignment'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
