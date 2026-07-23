import { documentService } from '@metorial/cargo-module-doc';
import { filePurposeService, fileService } from '@metorial/cargo-module-file';
import { storeItemMutationService } from '@metorial/cargo-module-store';
import type { Prisma, ResourceActor } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import { posix as path } from 'node:path';
import { parse } from 'yaml';
import { skillService } from '../services/skill';
import { getRelativeSkillPath, shouldImportSkillPath } from './discovery';
import { getCodeBucketFiles } from './repository';

let frontmatterRegex = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m;
let maxSkillFiles = 1000;
let maxSkillBytes = 100 * 1024 * 1024;

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export let parseImportedSkillMetadata = (d: {
  content: string;
  rootPath: string;
  repositoryName?: string | null;
}) => {
  let match = d.content.match(frontmatterRegex);
  let parsed = match ? parse(match[1] ?? '') : {};
  let frontmatter = isRecord(parsed) ? parsed : {};
  let rootName = d.rootPath === '/' ? d.repositoryName : path.basename(d.rootPath);
  let name = optionalString(frontmatter.name) ?? rootName ?? 'Imported skill';

  return {
    name,
    description: optionalString(frontmatter.description),
    license: optionalString(frontmatter.license),
    compatibility: optionalString(frontmatter.compatibility),
    metadata: isRecord(frontmatter.metadata)
      ? (frontmatter.metadata as Prisma.InputJsonValue)
      : undefined
  };
};

let isMarkdownPath = (filePath: string) =>
  ['.md', '.markdown'].includes(path.extname(filePath).toLowerCase());

let titleForMarkdown = (filePath: string, content: string) => {
  let heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(filePath).replace(/\.(md|markdown)$/i, '') || 'Document';
};

export let materializeImportedSkill = async (
  d: ResourceScope & {
    codeBucketId: string;
    skillId: string;
    rootPath: string;
    repositoryName?: string | null;
    actor?: ResourceActor;
    authorization?: ResourceAuthorization;
    onSkillCreated?: (
      skill: Awaited<ReturnType<typeof skillService.createSkill>>
    ) => void | Promise<void>;
    onProgress?: () => void | Promise<void>;
  }
) => {
  let authorization = d.authorization ?? {
    type: 'privileged' as const,
    resourceActor: d.actor
  };
  let bucketFiles = await getCodeBucketFiles({
    codeBucketId: d.codeBucketId,
    prefix: d.rootPath === '/' ? '' : d.rootPath,
    maxFiles: maxSkillFiles,
    maxTotalBytes: maxSkillBytes,
    include: file => {
      let relativePath = getRelativeSkillPath(d.rootPath, file.path);
      return !!relativePath && shouldImportSkillPath(relativePath);
    },
    onProgress: d.onProgress
  });
  let files = bucketFiles
    .map(file => ({
      ...file,
      relativePath: getRelativeSkillPath(d.rootPath, file.path)
    }))
    .filter(
      (file): file is typeof file & { relativePath: string } =>
        !!file.relativePath && shouldImportSkillPath(file.relativePath)
    )
    .sort((a, b) => {
      if (a.relativePath === '/SKILL.md') return -1;
      if (b.relativePath === '/SKILL.md') return 1;
      return a.relativePath.localeCompare(b.relativePath);
    });

  if (files.length > maxSkillFiles) throw new Error('Imported skill contains too many files');
  let totalBytes = files.reduce((total, file) => total + file.content.byteLength, 0);
  if (totalBytes > maxSkillBytes) throw new Error('Imported skill is too large');

  let rootDocument = files.find(file => file.relativePath === '/SKILL.md');
  if (!rootDocument) throw new Error('Imported skill does not contain SKILL.md');

  let metadata = parseImportedSkillMetadata({
    content: rootDocument.content.toString('utf8'),
    rootPath: d.rootPath,
    repositoryName: d.repositoryName
  });
  let skill = await skillService.createSkill({
    resourceTenant: d.resourceTenant!,
    resourceGroup: d.resourceGroup,
    input: {
      id: d.skillId,
      authorization,
      name: metadata.name,
      description: metadata.description,
      clientName: metadata.name,
      clientDescription: metadata.description,
      metadata: metadata.metadata,
      clientMetadata: metadata.metadata,
      license: metadata.license,
      compatibility: metadata.compatibility
    }
  });
  await d.onSkillCreated?.(skill);
  let genericPurpose = await filePurposeService.ensureGenericFilePurpose();

  for (let file of files) {
    await d.onProgress?.();
    if (isMarkdownPath(file.relativePath)) {
      let content = file.content.toString('utf8');
      await documentService.createDocument({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        input: {
          title:
            file.relativePath === '/SKILL.md'
              ? metadata.name
              : titleForMarkdown(file.relativePath, content),
          content,
          authorization,
          store: {
            id: skill.store!.id,
            path: file.relativePath
          }
        }
      });
      continue;
    }

    let importedFile = await fileService.createUploadedFile({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      purpose: genericPurpose.id,
      file: new Blob([file.content], {
        type: file.contentType || 'application/octet-stream'
      }),
      input: {
        name: path.basename(file.relativePath),
        title: path.basename(file.relativePath),
        mimeType: file.contentType || 'application/octet-stream',
        authorization
      }
    });
    await storeItemMutationService.attachTargetToStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: skill.store!,
      path: file.relativePath,
      target: {
        file: importedFile,
        document: null
      }
    });
  }

  return skill;
};
