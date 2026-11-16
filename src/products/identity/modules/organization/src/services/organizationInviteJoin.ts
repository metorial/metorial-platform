import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import { ID, OrganizationInvite, User, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isUserEmailVerified } from '../definitions/userEmailVerification';
import { organizationInviteService } from './organizationInvite';
import { organizationMemberService } from './organizationMember';

let normalizeEmail = (email: string) => email.trim().toLowerCase();

let inviteNoLongerPendingError = () =>
  new ServiceError(
    badRequestError({
      message: 'Invite has already been accepted or expired'
    })
  );

class OrganizationInviteJoinService {
  private async ensureInviteAddressedToUser(d: { invite: OrganizationInvite; user: User }) {
    if (d.invite.type != 'email') return;

    let inviteEmail = d.invite.email;
    let isAddressedToUser = inviteEmail
      ? normalizeEmail(inviteEmail) == normalizeEmail(d.user.email) ||
        (await isUserEmailVerified({ userId: d.user.id, email: inviteEmail }))
      : false;
    if (isAddressedToUser) return;

    throw new ServiceError(
      forbiddenError({
        message: 'This invite was sent to a different email address'
      })
    );
  }

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
        throw inviteNoLongerPendingError();
      }

      await this.ensureInviteAddressedToUser({ invite, user: d.user });

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

      if (invite.type == 'email') {
        let claimed = await db.organizationInvite.updateMany({
          where: { oid: invite.oid, status: invite.status },
          data: {
            status: 'accepted',
            acceptedAt: new Date()
          }
        });
        if (claimed.count != 1) throw inviteNoLongerPendingError();
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
        throw inviteNoLongerPendingError();
      }

      await this.ensureInviteAddressedToUser({ invite, user: d.user });

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

      if (invite.type == 'email') {
        let rejected = await db.organizationInvite.updateMany({
          where: { oid: invite.oid, status: invite.status },
          data: {
            status: 'rejected',
            rejectedAt: new Date()
          }
        });
        if (rejected.count != 1) throw inviteNoLongerPendingError();

        invite = await db.organizationInvite.findUniqueOrThrow({
          where: { oid: invite.oid },
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
