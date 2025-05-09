import { Context } from '@metorial/context';
import { ID, User, withTransaction } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { Service } from '@metorial/service';
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
      if (existingMember) {
        return {
          invite,
          organization: invite.organization,
          member: existingMember,
          actor: existingMember.actor
        };
      }

      await Fabric.fire('organization.invitation.accepted:before', {
        user: d.user,
        performedBy: invite.invitedBy,
        organization: invite.organization,
        invite
      });

      let member = await organizationMemberService.createOrganizationMember({
        user: d.user,
        organization: invite.organization,
        input: { role: invite.role },
        context: d.context,
        performedBy: { type: 'actor', actor: invite.invitedBy }
      });

      await Fabric.fire('organization.invitation.join.created:before', {
        invite,
        member,
        performedBy: invite.invitedBy,
        organization: invite.organization
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
        performedBy: invite.invitedBy,
        organization: invite.organization
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

      await db.organizationInvite.update({
        where: { oid: invite.oid },
        data: { useCount: { increment: 1 } }
      });

      await Fabric.fire('organization.invitation.accepted:after', {
        user: d.user,
        performedBy: invite.invitedBy,
        organization: invite.organization,
        invite
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

      await Fabric.fire('organization.invitation.rejected:before', {
        user: d.user,
        performedBy: invite.invitedBy,
        organization: invite.organization,
        invite
      });

      if (invite.type === 'email' && invite.email) {
        await db.organizationInvite.update({
          where: { oid: invite.oid },
          data: {
            status: 'rejected',
            rejectedAt: new Date()
          }
        });
      }

      await Fabric.fire('organization.invitation.rejected:after', {
        user: d.user,
        performedBy: invite.invitedBy,
        organization: invite.organization,
        invite
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
