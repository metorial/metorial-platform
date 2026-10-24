import { Service } from '@lowerdeck/service';
import { db, getId } from '@metorial-subspace/db';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import {
  loadSlateSubject,
  subjectKeyForCustomProviderVersion,
  subjectKeyForSlateVersion
} from '../lib/subjects';
import { internalSecurityReviewMirrorService } from './securityReviewMirror';

class InternalSecurityReviewSubjectServiceImpl {
  async ensureSlateReview(d: { providerVersionOid: bigint }) {
    let subject = await loadSlateSubject(d.providerVersionOid);
    if (!subject) return null;

    let subjectKey = subjectKeyForSlateVersion(subject);
    if (!subjectKey) return null;

    let local = await db.securityReview.findUnique({ where: { subjectKey } });
    if (local) return local;

    let global = await securityReviewGlobalRepository.ensureReview({
      id: getId('securityReview').id,
      subjectKey,
      slateRegistryId: subject.slate.slateIdOnRegistry!,
      slateVersionRegistryId: subject.slateVersion.versionIdOnRegistry!
    });

    await db.securityReview.upsert({
      where: { subjectKey },
      create: {
        oid: getId('securityReview').oid,
        id: global.id,
        globalId: global.id,
        subjectType: 'slate_version',
        scope: 'global',
        subjectKey,
        status: 'active',
        providerOid: subject.providerOid,
        providerVersionOid: subject.oid
      },
      update: {}
    });
    await internalSecurityReviewMirrorService.mirrorGlobalReview({
      globalReviewId: global.id
    });

    return await db.securityReview.findUniqueOrThrow({ where: { subjectKey } });
  }

  async ensureCustomProviderReview(d: { customProviderVersionOid: bigint }) {
    let version = await db.customProviderVersion.findUnique({
      where: { oid: d.customProviderVersionOid },
      include: { customProvider: true }
    });
    if (!version) return null;

    let subjectKey = subjectKeyForCustomProviderVersion(version);

    return await db.securityReview.upsert({
      where: { subjectKey },
      create: {
        ...getId('securityReview'),
        subjectType: 'custom_provider_version',
        scope: 'tenant',
        subjectKey,
        status: 'active',
        tenantOid: version.tenantOid,
        projectOid: version.projectOid,
        providerOid: version.customProvider.providerOid,
        providerVersionOid: version.providerVersionOid,
        customProviderVersionOid: version.oid
      },
      update: {
        providerOid: version.customProvider.providerOid ?? undefined,
        providerVersionOid: version.providerVersionOid ?? undefined
      }
    });
  }
}

export let internalSecurityReviewSubjectService = Service.create(
  'internalSecurityReviewSubjectService',
  () => new InternalSecurityReviewSubjectServiceImpl()
).build();
