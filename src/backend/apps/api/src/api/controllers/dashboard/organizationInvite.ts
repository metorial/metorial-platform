import { organizationInviteJoinService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { userGroup } from '../../middleware/userGroup';
import { organizationInvitePresenter } from '../../presenters';

export let dashboardOrganizationInviteController = Controller.create(
  {
    name: 'Organization',
    description: 'Read and write organization information'
  },
  {
    find: userGroup
      .use(isDashboardGroup())
      .get(Path('/dashboard/organization-join/find', 'dashboard.organizations.join.get'), {
        name: 'Join organization',
        description: 'Join an organization'
      })
      .query(
        'default',
        v.object({
          inviteKey: v.string()
        })
      )
      .output(organizationInvitePresenter)
      .do(async ctx => {
        let { invite } = await organizationInviteJoinService.getOrganizationInvite({
          inviteKey: ctx.query.inviteKey
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    accept: userGroup
      .use(isDashboardGroup())
      .post(
        Path('/dashboard/organization-join/accept', 'dashboard.organizations.join.accept'),
        {
          name: 'Join organization',
          description: 'Join an organization'
        }
      )
      .body(
        'default',
        v.object({
          invite_key: v.string()
        })
      )
      .output(organizationInvitePresenter)
      .do(async ctx => {
        let { invite } = await organizationInviteJoinService.acceptOrganizationInvite({
          user: ctx.user,
          inviteKey: ctx.body.invite_key,
          context: ctx.context
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      }),

    reject: userGroup
      .use(isDashboardGroup())
      .post(
        Path('/dashboard/organization-join/reject', 'dashboard.organizations.join.reject'),
        {
          name: 'Reject organization invite',
          description: 'Reject an organization invite'
        }
      )
      .body(
        'default',
        v.object({
          invite_key: v.string()
        })
      )
      .output(organizationInvitePresenter)
      .do(async ctx => {
        let { invite } = await organizationInviteJoinService.rejectOrganizationInvite({
          user: ctx.user,
          inviteKey: ctx.body.invite_key,
          context: ctx.context
        });

        return organizationInvitePresenter.present({ organizationInvite: invite });
      })
  }
);
