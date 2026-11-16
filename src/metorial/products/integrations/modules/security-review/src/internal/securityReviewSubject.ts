import { Service } from '@lowerdeck/service';
import { db, getId } from '@metorial-subspace/db';
import { securityReviewGlobalRepository } from '@metorial/multi-region';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { subjectKeyForProviderUsage } from '../lib/usage/base';
import {
  loadSlateSubject,
  subjectKeyForCustomProviderVersion,
  subjectKeyForSkill,
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

  async ensureUsageReview(d: { instanceOid: bigint; providerOid: bigint }) {
    let [instance, provider] = await Promise.all([
      db.instance.findUnique({ where: { oid: d.instanceOid } }),
      db.provider.findUnique({ where: { oid: d.providerOid } })
    ]);
    if (!instance || !provider) return null;

    let tenant = await db.tenant.findFirst({ where: { projectOid: instance.projectOid } });
    if (!tenant) return null;

    let subjectKey = subjectKeyForProviderUsage({
      instanceId: instance.id,
      providerId: provider.id
    });

    return await db.securityReview.upsert({
      where: { subjectKey },
      create: {
        ...getId('securityReview'),
        subjectType: 'provider_usage',
        scope: 'tenant',
        subjectKey,
        status: 'active',
        tenantOid: tenant.oid,
        projectOid: instance.projectOid,
        providerOid: provider.oid,
        instanceOid: instance.oid
      },
      update: {}
    });
  }

  async ensureSkillReview(d: { skillId: string }) {
    let skill = await metorialDb.skill.findUnique({
      where: { id: d.skillId },
      select: { id: true, status: true, project: { select: { id: true } } }
    });
    if (!skill || skill.status == 'deleted') {
      await db.securityReview.updateMany({
        where: { skillId: d.skillId, status: { not: 'deleted' } },
        data: { status: 'deleted' }
      });

      return null;
    }

    let project = await db.project.findUnique({
      where: { id: skill.project.id },
      select: { oid: true, tenantOid: true }
    });
    if (!project) return null;

    let subjectKey = subjectKeyForSkill(skill);

    return await db.securityReview.upsert({
      where: { subjectKey },
      create: {
        ...getId('securityReview'),
        subjectType: 'skill_version',
        scope: 'tenant',
        subjectKey,
        status: skill.status == 'archived' ? 'disabled' : 'active',
        skillId: skill.id,
        tenantOid: project.tenantOid,
        projectOid: project.oid
      },
      update: { status: skill.status == 'archived' ? 'disabled' : 'active' }
    });
  }
}

export let internalSecurityReviewSubjectService = Service.create(
  'internalSecurityReviewSubjectService',
  () => new InternalSecurityReviewSubjectServiceImpl()
).build();
