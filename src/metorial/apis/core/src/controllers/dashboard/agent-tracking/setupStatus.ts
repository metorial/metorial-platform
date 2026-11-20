import { agentTrackingSetupStatusService } from '@metorial/module-agent-tracking-query';
import { agentTrackingSetupStatusPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { agentTrackingBasePath, agentTrackingReadGroup } from './readGroup';

export let dashboardAgentTrackingSetupStatusController = Controller.create(
  {
    name: 'Agent Tracking Setup Status',
    description: 'Whether data is arriving, and which settings file options it shows are on.',
    hideInDocs: true
  },
  {
    get: agentTrackingReadGroup
      .get(
        Path(
          `${agentTrackingBasePath}/setup-status`,
          'dashboard.instance.agentTracking.setupStatus.get'
        ),
        {
          name: 'Get setup status',
          description:
            'Returns when data last arrived for the instance and, for each option of the settings file, whether the data of the last 30 days shows it is on. Results can be up to a minute old.',
          hideInDocs: true
        }
      )
      .output(agentTrackingSetupStatusPresenter)
      .do(async ctx => {
        let setupStatus = await agentTrackingSetupStatusService.getSetupStatus({
          organization: ctx.organization,
          project: ctx.project,
          instance: ctx.instance
        });

        return agentTrackingSetupStatusPresenter.present({ setupStatus });
      })
  }
);
