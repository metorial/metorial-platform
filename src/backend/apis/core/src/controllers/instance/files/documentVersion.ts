import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentVersionService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { documentVersionPresenter } from '../../../presenters';
import { documentGroup } from './document';

export let documentVersionGroup = documentGroup.use(async ctx => {
  if (!ctx.params.documentVersionId) {
    throw new Error('documentVersionId is required');
  }

  let documentVersion = await documentVersionService.getDocumentVersionById({
    documentVersionId: ctx.params.documentVersionId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    },
    ...getInstanceCargoAccess(ctx)
  });

  if (documentVersion.documentId !== ctx.document.id) {
    throw new ServiceError(notFoundError('document.version', ctx.params.documentVersionId));
  }

  return { documentVersion };
});

export let documentVersionController = Controller.create(
  {
    name: 'Document Versions',
    description: 'Inspect document version history for an instance document.'
  },
  {
    list: documentGroup
      .get(instancePath('documents/:documentId/versions', 'documents.versions.list'), {
        name: 'List document versions',
        description: 'Returns a paginated list of versions for a specific document.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .outputList(documentVersionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await documentVersionService.listDocumentVersions({
          documentId: ctx.document.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, documentVersion =>
          documentVersionPresenter.present({ documentVersion })
        );
      }),

    get: documentVersionGroup
      .get(
        instancePath(
          'documents/:documentId/versions/:documentVersionId',
          'documents.versions.get'
        ),
        {
          name: 'Get document version by ID',
          description: 'Retrieves a specific document version by its ID.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .output(documentVersionPresenter)
      .do(async ctx =>
        documentVersionPresenter.present({ documentVersion: ctx.documentVersion })
      )
  }
);
