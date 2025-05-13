import { forbiddenError, ServiceError } from '@metorial/error';
import { organizationInviteService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { organizationInvitePresenter } from '../../presenters';

export let organizationInviteManagementController = Controller.create(
  {
    name: 'Organization Invite',
    description: 'Read and write organization invite information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('invites', 'invites.list'), {
        name: 'List organization invites',
        description: 'List all organization invites'
      })
      .outputList(organizationInvitePresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await organizationInviteService.listOrganizationInvites({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, invite =>
          organizationInvitePresenter.present({ organizationInvite: invite })
        );
      }),

    get: organizationGroup
      .get(organizationManagementPath('invites/:inviteId', 'invites.get'), {
        name: 'Get organization invite',
        description: 'Get the information of a specific organization invite'
      })
      .output(organizationInvitePresenter)
      .do(async ctx => {
        let invite = await organizationInviteService.getOrganizationInviteById({
          organization: ctx.organization,
          inviteId: ctx.params.inviteId
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    create: organizationGroup
      .post(organizationManagementPath('invites', 'invites.create'), {
        name: 'Create organization invite',
        description: 'Create a new organization invite'
      })
      .body(
        'default',
        v.union([
          v.object({
            type: v.literal('email'),
            email: v.string(),
            role: v.enumOf(['member', 'admin']),
            message: v.optional(v.string())
          }),
          v.object({
            type: v.literal('link'),
            role: v.enumOf(['member', 'admin'])
          })
        ])
      )
      .output(organizationInvitePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization members'
            })
          );
        }

        let invite = await organizationInviteService.createOrganizationInvite({
          organization: ctx.organization,
          input: ctx.body,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    ensureLink: organizationGroup
      .post(organizationManagementPath('invites/ensure', 'invites.ensureLink'), {
        name: 'Ensure organization invite link',
        description: 'Ensure the invite link for the organization',
        hideInDocs: true
      })
      .output(organizationInvitePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization members'
            })
          );
        }

        let invite = await organizationInviteService.ensureOrganizationInviteLink({
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    delete: organizationGroup
      .delete(organizationManagementPath('invites/:inviteId', 'invites.delete'), {
        name: 'Delete organization invite',
        description: 'Remove an organization invite'
      })
      .output(organizationInvitePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization members'
            })
          );
        }

        let invite = await organizationInviteService.getOrganizationInviteById({
          organization: ctx.organization,
          inviteId: ctx.params.inviteId
        });

        invite = await organizationInviteService.deleteOrganizationInvite({
          invite,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    update: organizationGroup
      .post(organizationManagementPath('invites/:inviteId', 'invites.update'), {
        name: 'Update organization invite',
        description: 'Update the role of an organization invite'
      })
      .body(
        'default',
        v.object({
          role: v.enumOf(['member', 'admin'])
        })
      )
      .output(organizationInvitePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization members'
            })
          );
        }

        let invite = await organizationInviteService.getOrganizationInviteById({
          organization: ctx.organization,
          inviteId: ctx.params.inviteId
        });

        invite = await organizationInviteService.updateOrganizationInvite({
          invite,
          organization: ctx.organization,
          input: {
            role: ctx.body.role
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      })
  }
);
