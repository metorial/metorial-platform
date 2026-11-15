import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import { ID, User, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationInviteService } from './organizationInvite';
import { organizationMemberService } from './organizationMember';

class OrganizationInviteJoinService {
  async getOrganizationInvite(d: { inviteKey: string }) {
    return withTransaction(async db => {
      let invite = await organizationInviteService.getOrganizationInviteByKey({
        key: d.inviteKey
      });
      if (invite.status != 'pending' && invite.status != 'rejected') {
        throw new ServiceError(
          badRequestError({
            message: 'Invite has already been accepted or expired'
          })
        );
      }

      return { invite };
    });
  }

  async acceptOrganizationInvite(d: { user: User; inviteKey: string; context: Context }) {
    return withTransaction(async db => {
      let invite = await organizationInviteService.getOrganizationInviteByKey({
        key: d.inviteKey
      });
      if (invite.status != 'pending' && invite.status != 'rejected') {
        throw new ServiceError(
          badRequestError({
            message: 'Invite has already been accepted or expired'
          })
        );
      }

      let existingMember = await db.organizationMember.findFirst({
        where: {
          organizationOid: invite.organization.oid,
          userOid: d.user.oid
        },
        include: {
          actor: true,
          organization: true
        }
      });
      if (existingMember && existingMember.status == 'active') {
        return {
          invite,
          organization: invite.organization,
          member: existingMember,
          actor: existingMember.actor
        };
      }

      let previousInvite = invite;
      let auditScope = createOrganizationActorAuditScope({
        organization: invite.organization,
        organizationActor: invite.invitedBy,
        context: d.context
      });

      await Fabric.fire('organization.invitation.accepted:before', {
        user: d.user,
        organization: invite.organization,
        invite,
        auditScope
      });

      let member = await organizationMemberService.createOrganizationMember({
        user: d.user,
        organization: invite.organization,
        input: { role: invite.role },
        auditScope
      });

      await Fabric.fire('organization.invitation.join.created:before', {
        invite,
        member,
        organization: invite.organization,
        auditScope
      });

      let join = await db.organizationInviteJoin.create({
        data: {
          id: await ID.generateId('organizationInviteJoin'),
          inviteOid: invite.oid,
          memberOid: member.oid
        }
      });

      await Fabric.fire('organization.invitation.join.created:after', {
        join,
        invite,
        member,
        organization: invite.organization,
        auditScope
      });

      if (invite.type === 'email' && invite.email) {
        await db.organizationInvite.update({
          where: { oid: invite.oid },
          data: {
            status: 'accepted',
            acceptedAt: new Date()
          }
        });
      }

      invite = await db.organizationInvite.update({
        where: { oid: invite.oid },
        data: { useCount: { increment: 1 } },
        include: {
          organization: true,
          invitedBy: true
        }
      });

      await Fabric.fire('organization.invitation.accepted:after', {
        user: d.user,
        organization: invite.organization,
        invite,
        previousInvite,
        auditScope
      });

      return {
        invite,
        organization: invite.organization,
        member,
        actor: member.actor
      };
    });
  }

  async rejectOrganizationInvite(d: { user: User; inviteKey: string; context: Context }) {
    return withTransaction(async db => {
      let invite = await organizationInviteService.getOrganizationInviteByKey({
        key: d.inviteKey
      });
      if (invite.status != 'pending' && invite.status != 'rejected') {
        throw new ServiceError(
          badRequestError({
            message: 'Invite has already been accepted or expired'
          })
        );
      }

      let previousInvite = invite;
      let auditScope = createOrganizationActorAuditScope({
        organization: invite.organization,
        organizationActor: invite.invitedBy,
        context: d.context
      });

      await Fabric.fire('organization.invitation.rejected:before', {
        user: d.user,
        organization: invite.organization,
        invite,
        auditScope
      });

      if (invite.type === 'email' && invite.email) {
        invite = await db.organizationInvite.update({
          where: { oid: invite.oid },
          data: {
            status: 'rejected',
            rejectedAt: new Date()
          },
          include: {
            organization: true,
            invitedBy: true
          }
        });
      }

      await Fabric.fire('organization.invitation.rejected:after', {
        user: d.user,
        organization: invite.organization,
        invite,
        previousInvite,
        auditScope
      });

      return {
        organization: invite.organization,
        invite
      };
    });
  }
}

export let organizationInviteJoinService = Service.create(
  'organizationInviteJoinService',
  () => new OrganizationInviteJoinService()
).build();
