import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  subspaceBucketService,
  subspaceCustomProviderService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { bucketEditorTokenPresenter } from '../../../presenters';

let customProviderCodeGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderId is required',
        description: 'The customProviderId path parameter is required.'
      })
    );
  }

  let customProvider = await subspaceCustomProviderService.get({
    instance: ctx.instance,
    customProviderId: ctx.params.customProviderId
  });

  return { customProvider };
});

export let customProviderCodeController = Controller.create(
  {
    name: 'Custom Provider Code',
    description: 'Manage custom provider code editor access.'
  },
  {
    getCodeEditorToken: customProviderCodeGroup
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
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.code:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(bucketEditorTokenPresenter)
      .do(async ctx => {
        let draftBucket = ctx.customProvider.draftBucket;
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

        return bucketEditorTokenPresenter.present({
          token: {
            id: draftBucket.id,
            url: editorRes.url,
            expiresAt: editorRes.expiresAt
          }
        });
      })
  }
);
