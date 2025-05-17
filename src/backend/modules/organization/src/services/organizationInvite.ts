import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMemberRole,
  withTransaction
} from '@metorial/db';
import { forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { addDays } from 'date-fns';
import { sendOrgInviteEmail } from '../email/invite';

class OrganizationInviteService {
  private async ensureOrganizationInviteActive(organizationInvite: OrganizationInvite) {
    if (organizationInvite.status != 'deleted') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted organization invite'
        })
      );
    }
  }

  async createOrganizationInvite(d: {
    input: {
      role: OrganizationMemberRole;
    } & (
      | {
          type: 'email';
          email: string;
          message?: string;
        }
      | {
          type: 'link';
        }
    );
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.invitation.created:before', d);

      let invite = await db.organizationInvite.create({
        data: {
          id: await ID.generateId('organizationInvite'),
          status: 'pending',
          type: d.input.type,
          role: d.input.role,
          key: generateCustomId('metorial_inv', 50),
          expiresAt: addDays(new Date(), 14),

          organizationOid: d.organization.oid,
          invitedByOid: d.performedBy.oid,

          message: d.input.type == 'email' ? d.input.message : null,
          email: d.input.type == 'email' ? d.input.email : null
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });

      if (invite.type === 'email' && invite.email) {
        await sendOrgInviteEmail.send({
          data: {
            organization: invite.organization,
            invite: invite,
            actor: invite.invitedBy
          },
          to: [invite.email]
        });
      }

      await Fabric.fire('organization.invitation.created:after', {
        ...d,
        invite
      });

      return invite;
    });
  }

  async deleteOrganizationInvite(d: {
    invite: OrganizationInvite;
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationInviteActive(d.invite);

    return withTransaction(async db => {
      await Fabric.fire('organization.invitation.deleted:before', d);

      let invite = await db.organizationInvite.update({
        where: { oid: d.invite.oid },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });

      await Fabric.fire('organization.invitation.deleted:after', {
        ...d,
        invite
      });

      return invite;
    });
  }

  async updateOrganizationInvite(d: {
    invite: OrganizationInvite;
    input: {
      role: OrganizationMemberRole;
    };
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationInviteActive(d.invite);

    return withTransaction(async db => {
      await Fabric.fire('organization.invitation.updated:before', d);

      let invite = await db.organizationInvite.update({
        where: { oid: d.invite.oid },
        data: { role: d.input.role },
        include: {
          organization: true,
          invitedBy: true
        }
      });

      await Fabric.fire('organization.invitation.updated:after', {
        ...d,
        invite
      });

      return invite;
    });
  }

  async ensureOrganizationInviteLink(d: {
    organization: Organization;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    return withTransaction(async db => {
      let recentLink = await db.organizationInvite.findFirst({
        where: {
          organizationOid: d.organization.oid,
          invitedByOid: d.performedBy.oid,
          type: 'link',
          status: 'pending',
          expiresAt: {
            gte: addDays(new Date(), 7)
          }
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });

      if (recentLink) return recentLink;

      return await this.createOrganizationInvite({
        input: {
          role: 'member',
          type: 'link'
        },
        organization: d.organization,
        context: d.context,
        performedBy: d.performedBy
      });
    });
  }

  async getOrganizationInviteById(d: { organization: Organization; inviteId: string }) {
    let invite = await db.organizationInvite.findFirst({
      where: {
        id: d.inviteId,
        organizationOid: d.organization.oid
      },
      include: {
        organization: true,
        invitedBy: true
      }
    });
    if (!invite) throw new ServiceError(notFoundError('organization_invite', d.inviteId));

    return invite;
  }

  async getOrganizationInviteByKey(d: { key: string }) {
    let invite = await db.organizationInvite.findFirst({
      where: {
        key: d.key,
        status: 'pending'
      },
      include: {
        organization: true,
        invitedBy: true
      }
    });
    if (!invite) throw new ServiceError(notFoundError('organization_invite', null));

    return invite;
  }

  async listOrganizationInvites(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organizationInvite.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'pending',
              type: 'email'
            },
            include: {
              organization: true,
              invitedBy: true
            }
          })
      )
    );
  }
}

export let organizationInviteService = Service.create(
  'organizationInviteService',
  () => new OrganizationInviteService()
).build();
