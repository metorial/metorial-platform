import { organizationMemberService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { organizationMemberPresenter } from '../../presenters';

export let organizationMemberController = Controller.create(
  {
    name: 'Organization Member',
    description: 'Read and write organization member information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('members', 'members.list'), {
        name: 'List organization members',
        description: 'List all organization members'
      })
      .outputList(organizationMemberPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await organizationMemberService.listOrganizationMembers({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, member =>
          organizationMemberPresenter.present({ organizationMember: member })
        );
      }),

    get: organizationGroup
      .get(organizationManagementPath('members/:memberId', 'members.get'), {
        name: 'Get organization member',
        description: 'Get the information of a specific organization member'
      })
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      }),

    delete: organizationGroup
      .delete(organizationManagementPath('members/:memberId', 'members.delete'), {
        name: 'Delete organization member',
        description: 'Remove an organization member'
      })
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        member = await organizationMemberService.deleteOrganizationMember({
          member,
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      }),

    update: organizationGroup
      .post(organizationManagementPath('members/:memberId', 'members.update'), {
        name: 'Update organization member',
        description: 'Update the role of an organization member'
      })
      .body(
        'default',
        v.object({
          role: v.enumOf(['member', 'admin'])
        })
      )
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        member = await organizationMemberService.updateOrganizationMember({
          member,
          organization: ctx.organization,
          input: {
            role: ctx.body.role
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      })
  }
);
