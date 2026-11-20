import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { agentTrackingMemberService } from '@metorial/module-agent-tracking-query';
import { agentTrackingMemberPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { agentTrackingBasePath, agentTrackingReadGroup } from './readGroup';

export let dashboardAgentTrackingMemberController = Controller.create(
  {
    name: 'Agent Tracking Members',
    description: 'The people who have sent usage from AI coding agents.',
    hideInDocs: true
  },
  {
    list: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/members`,
          'dashboard.instance.agentTracking.members.list'
        ),
        {
          name: 'List members seen',
          description:
            'Returns the members who have sent usage to this instance in the last 400 days, most recently active first, with whether each matched a Metorial member. Pages by item id. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .query('default', Paginator.validate(v.object({})))
      .outputList(agentTrackingMemberPresenter)
      .do(async ctx => {
        let { list, truncated } = await agentTrackingMemberService.listMembers({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance,
          page: ctx.query
        });

        return Paginator.present(list, member =>
          agentTrackingMemberPresenter.present({ member, listTruncated: truncated })
        );
      })
  }
);
