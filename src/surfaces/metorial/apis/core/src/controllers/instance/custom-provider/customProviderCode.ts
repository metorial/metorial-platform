import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  bucketService,
  customProviderService
} from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { bucketEditorTokenPresenter } from '@metorial/presenters';

let customProviderCodeGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.customProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderId is required',
        description: 'The customProviderId path parameter is required.'
      })
    );
  }

  let customProvider = await customProviderService.getCustomProviderById({
    instance: ctx.instance,
    customProviderId: ctx.params.customProviderId
  });

  return { customProvider };
});

export let customProviderCodeController = Controller.create(
  {
    name: 'Custom Provider Code',
    description:
      'Custom provider code is the draft source of a function custom provider. It is edited in the browser through a short-lived editor token.'
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
          description:
            'Returns a short-lived editor token for the draft code of a custom provider. Fails when the provider has no draft code.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.code:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(bucketEditorTokenPresenter)
      .do(async ctx => {
        let draftBucket = ctx.customProvider.draftCodeBucket;
        if (!draftBucket?.id) {
          throw new ServiceError(
            badRequestError({
              message: 'This custom provider does not have a draft code bucket.'
            })
          );
        }

        let bucket = await bucketService.getBucketById({
          instance: ctx.instance,
          bucketId: draftBucket.id
        });

        let editorRes = await bucketService.getEditorUrl({
          instance: ctx.instance,
          bucket
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
