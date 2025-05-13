import { secretService } from '@metorial/module-secret';
import { secretTypeSlugs } from '@metorial/module-secret/src/definitions';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { secretPresenter } from '../../presenters';

export let secretGroup = instanceGroup.use(async ctx => {
  let secret = await secretService.getSecretById({
    secretId: ctx.params.secretId,
    instance: ctx.instance
  });

  return { secret };
});

export let secretController = Controller.create(
  {
    name: 'Secret',
    description: 'Read and write secret information'
  },
  {
    list: instanceGroup
      .get(instancePath('secrets', 'secrets.list'), {
        name: 'List secrets',
        description: 'List all  secrets'
      })
      .use(checkAccess({ possibleScopes: ['instance.secret:read'] }))
      .outputList(secretPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.enumOf(secretTypeSlugs as any))
          })
        )
      )
      .do(async ctx => {
        let paginator = await secretService.listSecrets({
          instance: ctx.instance,
          type: (ctx.query as any).type
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, secret => secretPresenter.present({ secret }));
      }),

    get: secretGroup
      .get(instancePath('secrets/:secretId', 'secrets.get'), {
        name: 'Get secret',
        description: 'Get the information of a specific secret'
      })
      .use(checkAccess({ possibleScopes: ['instance.secret:read'] }))
      .output(secretPresenter)
      .do(async ctx => {
        return secretPresenter.present({ secret: ctx.secret });
      })
  }
);
