import { SecretStatus } from '@metorial/db';
import { secretService } from '@metorial/module-secret';
import { secretTypeSlugs } from '@metorial/module-secret/src/definitions';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { secretPresenter } from '../../presenters';

export let secretGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.secretId) throw new Error('secretId is required');

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
            type: v.optional(
              v.union([
                v.enumOf(secretTypeSlugs as any),
                v.array(v.enumOf(secretTypeSlugs as any))
              ])
            ),
            status: v.optional(
              v.union([
                v.enumOf(Object.keys(SecretStatus) as any),
                v.array(v.enumOf(Object.keys(SecretStatus) as any))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await secretService.listSecrets({
          instance: ctx.instance,
          type: normalizeArrayParam(ctx.query.type) as any,
          status: normalizeArrayParam(ctx.query.status) as any
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
