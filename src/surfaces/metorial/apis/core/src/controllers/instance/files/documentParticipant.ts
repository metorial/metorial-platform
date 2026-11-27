import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentParticipantService } from '@metorial/module-documents';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { documentParticipantPresenter } from '@metorial/presenters';
import { stringArrayFilterSchema } from './_listFilters';
import { documentGroup } from './document';

export let documentParticipantGroup = documentGroup.use(async ctx => {
  if (!ctx.params.documentParticipantId) {
    throw new Error('documentParticipantId is required');
  }

  let documentParticipant = await documentParticipantService.getDocumentParticipantById({
    documentParticipantId: ctx.params.documentParticipantId,
    ...(await getInstanceCargoAccess(ctx))
  });

  if (documentParticipant.document.id !== ctx.document.id) {
    throw new ServiceError(
      notFoundError('document.participant', ctx.params.documentParticipantId)
    );
  }

  return { documentParticipant };
});

export let documentParticipantController = Controller.create(
  {
    name: 'Document Participants',
    description: 'A document participant is an actor with access to a document.'
  },
  {
    list: documentGroup
      .get(instancePath('documents/:documentId/participants', 'documents.participants.list'), {
        name: 'List document participants',
        description: 'Returns a paginated list of participants in a document.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .outputList(documentParticipantPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Only return participants with one of these IDs.'),
            created_at: dateFilterValidator('participant creation time'),
            updated_at: dateFilterValidator('participant last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await documentParticipantService.listDocumentParticipants({
          documentId: ctx.document.id,
          ...(await getInstanceCargoAccess(ctx)),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at,
          lastEditedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, documentParticipant =>
          documentParticipantPresenter.present({ documentParticipant })
        );
      }),

    get: documentParticipantGroup
      .get(
        instancePath(
          'documents/:documentId/participants/:documentParticipantId',
          'documents.participants.get'
        ),
        {
          name: 'Get document participant',
          description: 'Retrieves a participant in a document.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .output(documentParticipantPresenter)
      .do(async ctx =>
        documentParticipantPresenter.present({ documentParticipant: ctx.documentParticipant })
      )
  }
);
