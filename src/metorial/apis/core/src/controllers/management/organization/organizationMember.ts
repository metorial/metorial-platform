import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  accessPolicyAssignmentService,
  accessPolicyService,
  organizationMemberService
} from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { organizationMemberPresenter } from '@metorial/presenters';

export let organizationMemberManagementController = Controller.create(
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
      .use(checkAccess({ possibleScopes: ['organization.member:read'] }))
      .outputList(organizationMemberPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            team_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by team ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await organizationMemberService.listOrganizationMembers({
          organization: ctx.organization,
          teamIds: normalizeArrayParam(ctx.query.team_id)
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
      .use(checkAccess({ possibleScopes: ['organization.member:read'] }))
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
      .use(checkAccess({ possibleScopes: ['organization.member:write'] }))
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        member = await organizationMemberService.deleteOrganizationMember({
          member,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      }),

    update: organizationGroup
      .post(organizationManagementPath('members/:memberId', 'members.update'), {
        name: 'Update organization member',
        description: 'Update the role of an organization member'
      })
      .use(checkAccess({ possibleScopes: ['organization.member:write'] }))
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
          auditScope: ctx.auditScope
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      }),

    assignPolicy: organizationGroup
      .post(
        organizationManagementPath('members/:memberId/policies', 'members.policies.create'),
        {
          name: 'Assign policy to organization member',
          description: 'Assign an access policy to an organization member'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .body(
        'default',
        v.object({
          access_policy_id: v.string()
        })
      )
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.body.access_policy_id
        });

        await accessPolicyAssignmentService.assignAccessPolicyToMember({
          organization: ctx.organization,
          member,
          accessPolicy,
          auditScope: ctx.auditScope
        });

        member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      }),

    removePolicy: organizationGroup
      .delete(
        organizationManagementPath(
          'members/:memberId/policies/:accessPolicyId',
          'members.policies.delete'
        ),
        {
          name: 'Remove policy from organization member',
          description: 'Remove an access policy from an organization member'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .output(organizationMemberPresenter)
      .do(async ctx => {
        let member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.params.accessPolicyId
        });

        await accessPolicyAssignmentService.removeAccessPolicyFromMember({
          organization: ctx.organization,
          member,
          accessPolicy,
          auditScope: ctx.auditScope
        });

        member = await organizationMemberService.getOrganizationMemberById({
          organization: ctx.organization,
          memberId: ctx.params.memberId
        });

        return organizationMemberPresenter.present({ organizationMember: member });
      })
  }
);
