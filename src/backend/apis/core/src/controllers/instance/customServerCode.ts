import { badRequestError, ServiceError } from '@metorial/error';
import { codeBucketService } from '@metorial/module-code-bucket';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { customServerCodeEditorTokenTypePresenter } from '../../presenters';
import { customServerGroup } from './customServer';

export let customServerCodeController = Controller.create(
  {
    name: 'Custom Server code',
    description: 'Manager custom server deployments',
    hideInDocs: true
  },
  {
    getCodeEditorToken: customServerGroup
      .get(
        instancePath(
          'custom-servers/:customServerId/code-editor-token',
          'custom_servers.code.getCodeEditorToken'
        ),
        {
          name: 'Get code editor token',
          description: 'Get a token to access the code editor for a custom server'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .output(customServerCodeEditorTokenTypePresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        if (!ctx.customServer.draftCodeBucket) {
          throw new ServiceError(
            badRequestError({
              message: `Server of type '${ctx.customServer.type}' does not support code editing`
            })
          );
        }

        let tokenRes = await codeBucketService.getEditorToken({
          codeBucket: ctx.customServer.draftCodeBucket
        });

        return customServerCodeEditorTokenTypePresenter.present(tokenRes);
      })
  }
);
