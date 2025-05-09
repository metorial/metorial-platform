import { Context } from '@metorial/context';
import {
  ApiKey,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationInviteJoin,
  OrganizationMember,
  Project,
  User,
  UserSession
} from '@metorial/db';

export type MachineAccessInput =
  | {
      type: 'user_auth_token';
      user: User;
    }
  | {
      type: 'organization_management';
      organization: Organization;
      performedBy: OrganizationActor;
    }
  | {
      type: 'instance_secret' | 'instance_publishable';
      organization: Organization;
      instance: Instance;
      performedBy: OrganizationActor;
    };

// prettier-ignore
export interface FabricEvents {
  'user.created:before': { context?: Context };
  'user.created:after': { user: User, performedBy: User; context?: Context };
  'user.updated:before': { user: User, performedBy: User; context?: Context };
  'user.updated:after': { user: User, performedBy: User; context?: Context };
  'user.deleted:before': { user: User, performedBy: User; context?: Context };
  'user.deleted:after': { user: User, performedBy: User; context?: Context };

  'user.session.created:before': { user: User, performedBy: User; context?: Context };
  'user.session.created:after': { user: User, session: UserSession, performedBy: User; context?: Context };
  // 'user.session.updated:before': { user: User, session: UserSession, performedBy: User; context?: Context };
  // 'user.session.updated:after': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:before': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:after': { user: User, session: UserSession, performedBy: User; context?: Context };

  'organization.created:before': { performedBy: User; context?: Context };
  'organization.created:after': { organization: Organization, performedBy: User; context?: Context };
  'organization.updated:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.updated:after': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.deleted:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.deleted:after': { organization: Organization, performedBy: OrganizationActor; context?: Context };

  'organization.actor.created:before': { organization: Organization, performedBy: {type: 'user', user: User} | {type: 'actor', actor: OrganizationActor}; context?: Context };
  'organization.actor.created:after': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  'organization.actor.updated:before': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  'organization.actor.updated:after': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  // 'organization.actor.deleted:before': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  // 'organization.actor.deleted:after': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };

  'organization.member.created:before': { organization: Organization; actor: OrganizationActor; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.member.created:after': { organization: Organization; actor: OrganizationActor; user: User; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.updated:before': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.updated:after': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.deleted:before': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.deleted:after': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };

  'organization.invitation.created:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.invitation.created:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.updated:before': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.updated:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.deleted:before': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.deleted:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  
  'organization.invitation.accepted:before': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.accepted:after': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.rejected:before': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.rejected:after': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };

  'organization.invitation.join.created:before': { organization: Organization, member: OrganizationMember; invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.join.created:after': { organization: Organization, member: OrganizationMember; invite: OrganizationInvite; join: OrganizationInviteJoin; performedBy: OrganizationActor; context?: Context };

  'organization.project.created:before': { organization: Organization,  performedBy: OrganizationActor; context?: Context };
  'organization.project.created:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.deleted:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.deleted:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };

  'organization.project.instance.created:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.created:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };

  'machine_access.created:before': MachineAccessInput & { context?: Context };
  'machine_access.created:after': MachineAccessInput & { context?: Context, machineAccess: MachineAccess };
  'machine_access.updated:before': { machineAccess: MachineAccess, performedBy?: OrganizationActor; context?: Context };
  'machine_access.updated:after': { machineAccess: MachineAccess, performedBy?: OrganizationActor; context?: Context };
  'machine_access.deleted:before': { machineAccess: MachineAccess, performedBy?: OrganizationActor; context?: Context };
  'machine_access.deleted:after': { machineAccess: MachineAccess, performedBy?: OrganizationActor; context?: Context };

  'machine_access.api_key.created:before': { machineAccess: MachineAccess, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.created:after': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.updated:before': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.updated:after': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.revoked:before': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.revoked:after': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.rotated:before': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.rotated:after': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
  'machine_access.api_key.expired:before': { machineAccess: MachineAccess, apiKey: ApiKey };
  'machine_access.api_key.expired:after': { machineAccess: MachineAccess, apiKey: ApiKey };
  'machine_access.api_key:revealed': { machineAccess: MachineAccess, apiKey: ApiKey, performedBy?: OrganizationActor; context?: Context };
}
