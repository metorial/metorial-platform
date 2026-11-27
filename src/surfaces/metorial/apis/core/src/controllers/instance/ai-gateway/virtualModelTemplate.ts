import { Paginator } from '@lowerdeck/pagination';
import { aiGatewayVirtualModelService } from '@metorial/module-ai-gateway';
import { aiGatewayVirtualModelTemplatePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayInstanceGroup, aiGatewayReadScopes } from './_middleware';

export let aiGatewayVirtualModelTemplateController = Controller.create(
  {
    name: 'AI gateway virtual model templates',
    description:
      'Ready-made virtual model definitions for common routing setups. Pick the models they ask for to create a virtual model from one.'
  },
  {
    list: aiGatewayInstanceGroup
      .get(
        instancePath(
          'ai-gateway/virtual-model-templates',
          'aiGateway.virtualModelTemplates.list'
        ),
        {
          name: 'List AI gateway virtual model templates',
          description: 'Returns every template. The list is not paginated.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayVirtualModelTemplatePresenter)
      .do(async ctx => {
        let templates = await aiGatewayVirtualModelService.listTemplates({
          instance: ctx.instance
        });

        return Paginator.present(
          { items: templates, pagination: { hasNextPage: false, hasPreviousPage: false } },
          template => aiGatewayVirtualModelTemplatePresenter.present({ template })
        );
      })
  }
);
