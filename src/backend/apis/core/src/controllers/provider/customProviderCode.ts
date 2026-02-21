import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceBucketService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { customServerCodeEditorTokenTypePresenter } from '../../presenters';
import { customProviderGroup } from './customProvider';

export let customProviderCodeController = Controller.create(
  {
    name: 'Custom Provider Code',
    description: 'Manage custom provider code editor access.'
  },
  {
    getCodeEditorToken: customProviderGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/code-editor-token',
          'customProviders.code.getCodeEditorToken'
        ),
        {
          name: 'Get code editor token',
          description: 'Get a token to access the code editor for a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .output(customServerCodeEditorTokenTypePresenter)
      .do(async ctx => {
        let draftBucket = (ctx.customProvider as any).draftBucket;

        if (!draftBucket?.id) {
          throw new ServiceError(
            badRequestError({
              message: 'This custom provider does not have a draft code bucket.'
            })
          );
        }

        let editorRes = await subspaceBucketService.getEditorUrl({
          instance: ctx.instance,
          bucketId: draftBucket.id
        });

        return customServerCodeEditorTokenTypePresenter.present({
          id: draftBucket.id,
          token: editorRes.url,
          expiresAt: editorRes.expiresAt
        });
      })
  }
);
