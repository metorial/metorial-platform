import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { assistantService } from '@metorial/module-assistant';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { assistantPresenter } from '../../../presenters';

export let assistantHandlers = {
  listAssistants: instanceGroup
    .get(instancePath('assistants', 'assistants.list'), {
      name: 'List assistants',
      description: 'List assistants available in an instance.'
    })
    .use(
      checkAccess({
        possibleScopes: ['instance.assistant:read', 'consumer#instance.assistant:read']
      })
    )
    .use(requireConsumerTokenForPublishableKey())
    .query('default', Paginator.validate(v.object({})))
    .outputList(assistantPresenter)
    .do(async ctx => {
      let paginator = await assistantService.list({
        instance: ctx.instance
      });
      let list = await paginator.run(ctx.query);

      return Paginator.present(list, assistant =>
        assistantPresenter.present({ assistant, organization: ctx.organization })
      );
    }),

  getAssistant: instanceGroup
    .get(instancePath('assistants/:assistantId', 'assistants.get'), {
      name: 'Get assistant',
      description: 'Get an assistant available in an instance.'
    })
    .use(
      checkAccess({
        possibleScopes: ['instance.assistant:read', 'consumer#instance.assistant:read']
      })
    )
    .use(requireConsumerTokenForPublishableKey())
    .output(assistantPresenter)
    .do(async ctx => {
      let assistant = await assistantService.get({
        instance: ctx.instance,
        assistantId: requireParam(ctx.params, 'assistantId')
      });

      return assistantPresenter.present({ assistant, organization: ctx.organization });
    })
};
