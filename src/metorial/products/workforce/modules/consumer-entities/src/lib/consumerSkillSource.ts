import { once } from '@lowerdeck/once';
import type {
  RequestScopedSkillSource,
  SkillSourceLimits
} from '@metorial-subspace/module-connection';
import { skillFileService, skillService } from '@metorial/module-skill';
import {
  getSkillAgentName,
  normalizeSkillAgentName,
  parseSkillDocumentFrontmatter,
  skillDocumentPath
} from '@metorial/module-skill/frontmatter';
import {
  createConsumerSkillAccess,
  type ConsumerSkillAccessInput
} from './consumerSkillAccess';
import { assignSkillNames, isExcludedSkillPath } from './skillCatalogNames';

let maxCatalogSkills = 1000;

let parseFrontmatter = (text: string) => parseSkillDocumentFrontmatter(text).frontmatter;

export let createConsumerSkillSource = async (
  d: ConsumerSkillAccessInput
): Promise<RequestScopedSkillSource | null> => {
  let skillAccess = await createConsumerSkillAccess(d);
  if (!skillAccess) return null;

  let { getAccess } = skillAccess;

  let getNamedSkills = once(async () => {
    let access = await getAccess();
    if (access.allowedSkillIds?.size === 0) return [];

    let records = await skillService.listSkillRecords({
      ...access.scope,
      ids: access.allowedSkillIds ? [...access.allowedSkillIds] : undefined,
      accessTags: access.accessTags,
      take: maxCatalogSkills,
      select: {
        id: true,
        slug: true,
        name: true,
        clientName: true,
        storeOid: true,
        skillPluginSkills: d.skillPluginOid
          ? {
              where: { skillPluginOid: d.skillPluginOid, status: 'active' },
              select: { pluginSkillSlug: true },
              take: 1
            }
          : false
      }
    });

    return assignSkillNames(
      records.flatMap(record => {
        if (record.storeOid === null) return [];

        let pluginSkillSlug = record.skillPluginSkills?.[0]?.pluginSkillSlug;

        return [
          {
            id: record.id,
            slug: record.slug,
            baseName: pluginSkillSlug
              ? normalizeSkillAgentName(pluginSkillSlug)
              : getSkillAgentName(record)
          }
        ];
      })
    );
  });

  let loadSkill = async (skillId: string, limits: SkillSourceLimits) => {
    let namedSkill = (await getNamedSkills()).find(entry => entry.id === skillId);
    if (!namedSkill) return null;

    let access = await getAccess();

    let skill = await skillService.getSkillById({
      ...access.scope,
      skillId,
      accessTags: access.accessTags
    });

    let scope = { ...access.scope, skill, authorization: access.authorization };

    let options = {
      includePath: (path: string) => !isExcludedSkillPath(path),
      limits,
      skillName: namedSkill.name
    };

    return {
      list: () => skillFileService.listSkillSnapshotFiles({ ...scope, options }),
      listEntries: () => skillFileService.listSkillSnapshotEntries({ ...scope, options }),
      read: (path: string) =>
        skillFileService.readSkillSnapshotFile({ ...scope, path, options })
    };
  };

  let listSkills: RequestScopedSkillSource['listSkills'] = async () =>
    (await getNamedSkills()).map(skill => ({ id: skill.id, name: skill.name }));

  let getSkillDocument: RequestScopedSkillSource['getSkillDocument'] = async input => {
    let file = await (await loadSkill(input.skillId, input.limits))?.read(skillDocumentPath);
    if (file?.text == null) return null;

    return {
      frontmatter: parseFrontmatter(file.text),
      size: file.size
    };
  };

  let listSkillFiles: RequestScopedSkillSource['listSkillFiles'] = async input => {
    let files = await (await loadSkill(input.skillId, input.limits))?.list();
    let skillDocument = files?.find(file => file.path === skillDocumentPath);
    if (!files || skillDocument?.text == null) return null;

    return {
      frontmatter: parseFrontmatter(skillDocument.text),
      files: files.map(file => ({
        path: file.path,
        mimeType: file.mimeType,
        size: file.size,
        sha256: file.sha256
      }))
    };
  };

  let listSkillEntries: RequestScopedSkillSource['listSkillEntries'] = async input =>
    (await (await loadSkill(input.skillId, input.limits))?.listEntries()) ?? null;

  let readSkillFile: RequestScopedSkillSource['readSkillFile'] = async input =>
    (await (await loadSkill(input.skillId, input.limits))?.read(input.path)) ?? null;

  return { listSkills, getSkillDocument, listSkillFiles, listSkillEntries, readSkillFile };
};
