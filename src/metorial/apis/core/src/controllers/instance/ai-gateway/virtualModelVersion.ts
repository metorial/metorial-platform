import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { aiGatewayVirtualModelService } from '@metorial/module-ai-gateway';
import { aiGatewayVirtualModelVersionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { aiGatewayReadScopes } from './_middleware';
import { aiGatewayVirtualModelGroup } from './virtualModel';

export let aiGatewayVirtualModelVersionController = Controller.create(
  {
    name: 'AI gateway virtual model versions',
    description:
      'Every change to the definition of a virtual model is kept as a numbered version that can be rolled back to.'
  },
  {
    list: aiGatewayVirtualModelGroup
      .get(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/versions',
          'aiGateway.virtualModels.versions.list'
        ),
        {
          name: 'List AI gateway virtual model versions',
          description: 'Returns a paginated list of the versions of a virtual model.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .outputList(aiGatewayVirtualModelVersionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = aiGatewayVirtualModelService.listVersions({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          aiGatewayVirtualModelVersionPresenter.present({ version })
        );
      }),

    get: aiGatewayVirtualModelGroup
      .get(
        instancePath(
          'ai-gateway/virtual-models/:virtualModelId/versions/:versionId',
          'aiGateway.virtualModels.versions.get'
        ),
        {
          name: 'Get AI gateway virtual model version',
          description: 'Retrieves a version of a virtual model by ID, with its definition.'
        }
      )
      .use(checkAccess({ possibleScopes: [...aiGatewayReadScopes] }))
      .output(aiGatewayVirtualModelVersionPresenter)
      .do(async ctx => {
        let version = await aiGatewayVirtualModelService.getVersion({
          instance: ctx.instance,
          virtualModel: ctx.virtualModel,
          versionId: requireParam(ctx.params, 'versionId')
        });

        return aiGatewayVirtualModelVersionPresenter.present({ version });
      })
  }
);
