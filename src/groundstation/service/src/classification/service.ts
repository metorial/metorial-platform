import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Entity, Organization } from '../../prisma/generated/client';
import { reattributeSession } from '../attribution/session';
import { db } from '../db';
import { isLinkAllowed } from '../entities/linkRules';
import { getId } from '../id';
import { entityService } from '../services/entity';
import { linkService } from '../services/link';
import type {
  ClassificationResult,
  SessionClassification,
  SessionDocument
} from '../store/derivedModels';
import { isClassifiableKind } from './candidates';
import { contextHash, labelFeatures } from './features';
import { labelEvidenceFilter } from './priors';
import { classificationStatus } from './results';
import { sessionCollections, writeSessionClassification } from './run';
import { maybeClassifySession } from './trigger';

export let learnedLinkConfirmations = 3;
let learnedLinkShare = 0.8;
let maxLearnedLinkLabels = 200;

class SessionClassificationServiceImpl {
  async getSession(d: { organization: Organization; sessionKey: string }) {
    let collections = await sessionCollections();

    let session = await collections.sessions.findOne({
      _id: d.sessionKey,
      organizationId: d.organization.id
    });
    if (!session) throw new ServiceError(notFoundError('session', d.sessionKey));

    return session;
  }

  async reviewSession(d: {
    organization: Organization;
    session: SessionDocument;
    input: { kind: string; action: 'accept' | 'reject'; entityId?: string };
  }) {
    if (!isClassifiableKind(d.input.kind)) {
      throw new ServiceError(
        badRequestError({ message: `Sessions are not classified by ${d.input.kind}.` })
      );
    }

    let previous = d.session.classification;
    let current = previous?.results.find(result => result.kind == d.input.kind);
    let suggested = current?.accepted?.entityId ?? current?.candidates[0]?.entityId;
    let at = new Date();

    let result: ClassificationResult;
    let confirmed: Entity | undefined;

    if (d.input.action == 'accept') {
      let entityId = d.input.entityId ?? suggested;
      if (!entityId) {
        throw new ServiceError(
          badRequestError({ message: 'entityId is required when there is no suggestion.' })
        );
      }

      confirmed = await this.getCandidateEntity({
        organization: d.organization,
        session: d.session,
        kind: d.input.kind,
        entityId
      });

      result = {
        kind: d.input.kind,
        stage: current?.stage ?? 'review',
        candidates: current?.candidates ?? [],
        accepted: { entityId: confirmed.id, confidence: 1 },
        rejectedEntityIds: current?.rejectedEntityIds?.filter(id => id != confirmed!.id),
        review: { action: 'accept', entityId: confirmed.id, at }
      };
    } else {
      let entityId = d.input.entityId ?? suggested;
      if (!current || !entityId) {
        throw new ServiceError(
          badRequestError({
            message: `The session has no ${d.input.kind} suggestion to reject.`
          })
        );
      }

      result = {
        kind: d.input.kind,
        stage: current.stage,
        candidates: current.candidates.filter(candidate => candidate.entityId != entityId),
        rejectedEntityIds: [...new Set([...(current.rejectedEntityIds ?? []), entityId])],
        review: { action: 'reject', entityId, at }
      };
    }

    let results = [
      ...(previous?.results ?? []).filter(item => item.kind != d.input.kind),
      result
    ];

    let classification: SessionClassification = {
      status: classificationStatus(results),
      runs: previous?.runs ?? 0,
      clefCalls: previous?.clefCalls ?? 0,
      contextHash: previous?.contextHash ?? contextHash(d.session.context),
      results,
      at
    };

    let collections = await sessionCollections();
    let written = await writeSessionClassification({
      collections,
      session: d.session,
      classification
    });
    if (!written) {
      throw new ServiceError(
        conflictError({ message: 'The session classification changed. Try again.' })
      );
    }

    if (confirmed) {
      await this.storeLabel({
        organization: d.organization,
        session: d.session,
        entity: confirmed
      });
      await this.learnLinks({
        organization: d.organization,
        session: d.session,
        entity: confirmed
      });
    } else {
      await db.classifierLabel.deleteMany({
        where: {
          organizationOid: d.organization.oid,
          kind: d.input.kind,
          sessionKey: d.session._id,
          entity: { id: result.review!.entityId }
        }
      });
    }

    await reattributeSession({ sessionKey: d.session._id });

    return classification;
  }

  async reclassifySession(d: { organization: Organization; session: SessionDocument }) {
    return await maybeClassifySession({ sessionKey: d.session._id, reason: 'manual' });
  }

  private async getCandidateEntity(d: {
    organization: Organization;
    session: SessionDocument;
    kind: string;
    entityId: string;
  }) {
    let entity = await entityService.getEntityById({
      organization: d.organization,
      entityId: d.entityId
    });

    if (entity.kind != d.kind || entity.status != 'managed') {
      throw new ServiceError(
        badRequestError({ message: `The entity ${entity.id} is not a managed ${d.kind}.` })
      );
    }

    let outOfScope =
      (entity.scopeInstance && entity.scopeInstance.id != d.session.instanceId) ||
      (entity.scopeProject && entity.scopeProject.id != d.session.projectId);
    if (outOfScope) {
      throw new ServiceError(
        badRequestError({ message: `The entity ${entity.id} is not in the session's scope.` })
      );
    }

    return entity;
  }

  private async storeLabel(d: {
    organization: Organization;
    session: SessionDocument;
    entity: Entity;
  }) {
    let features = labelFeatures(d.session);

    await db.classifierLabel.upsert({
      where: {
        organizationOid_kind_sessionKey: {
          organizationOid: d.organization.oid,
          kind: d.entity.kind,
          sessionKey: d.session._id
        }
      },
      create: {
        ...getId('classifierLabel'),
        kind: d.entity.kind,
        sessionKey: d.session._id,
        features,
        organizationOid: d.organization.oid,
        entityOid: d.entity.oid
      },
      update: { features, entityOid: d.entity.oid }
    });
  }

  // 07 §7.2 learned links: once a workspace or repo has been confirmed for the same entity often
  // enough (and almost never for another), future sessions resolve through the link graph.
  private async learnLinks(d: {
    organization: Organization;
    session: SessionDocument;
    entity: Entity;
  }) {
    let sources = [
      ...(d.session.context?.workspaceIds ?? []).map(id => ({ id, kind: 'workspace' })),
      ...(d.session.context?.repoIds ?? []).map(id => ({ id, kind: 'repo' }))
    ].filter(source =>
      isLinkAllowed({ type: 'part_of', fromKind: source.kind, toKind: d.entity.kind })
    );

    for (let source of sources) {
      let labels = await db.classifierLabel.findMany({
        where: {
          organizationOid: d.organization.oid,
          kind: d.entity.kind,
          OR: labelEvidenceFilter({
            workspaceIds: source.kind == 'workspace' ? [source.id] : [],
            repoIds: source.kind == 'repo' ? [source.id] : []
          })
        },
        orderBy: { createdAt: 'desc' },
        take: maxLearnedLinkLabels,
        select: { entityOid: true }
      });

      let confirmations = labels.filter(label => label.entityOid == d.entity.oid).length;
      if (confirmations < learnedLinkConfirmations) continue;
      if (confirmations / labels.length < learnedLinkShare) continue;

      let from = await db.entity.findFirst({
        where: {
          id: source.id,
          organizationOid: d.organization.oid,
          kind: source.kind,
          status: { in: ['managed', 'discovered'] }
        }
      });
      if (!from) continue;

      let existing = await db.entityLink.findFirst({
        where: {
          fromOid: from.oid,
          type: 'part_of',
          validTo: null,
          to: { kind: d.entity.kind }
        }
      });
      if (existing) continue;

      await linkService.upsertLink({
        organization: d.organization,
        from,
        to: d.entity,
        input: { type: 'part_of', origin: 'classifier', reach: 'from_now' }
      });
    }
  }
}

export let sessionClassificationService = Service.create(
  'sessionClassificationService',
  () => new SessionClassificationServiceImpl()
).build();
