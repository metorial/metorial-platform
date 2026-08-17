import { documentService } from '@metorial/module-documents';
import { filePurposeService, fileService } from '@metorial/module-file';
import { skillService } from '@metorial/module-skill';
import { storeItemMutationService } from '@metorial/module-store';
import type { Instance, Prisma, Project, ResourceActor } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { parseSkillDocumentFrontmatter } from '@metorial/module-skill-marketplace';
import { posix as path } from 'node:path';
import { getRelativeSkillPath, shouldImportSkillPath } from './discovery';
import { getCodeBucketFiles } from './repository';

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
  let { frontmatter } = parseSkillDocumentFrontmatter(d.content);
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

export let materializeImportedSkill = async (d: {
  project: Project;
  instance: Instance;
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
}) => {
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
    project: d.project,
    instance: d.instance,
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
        project: d.project,
        instance: d.instance,
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
      project: d.project,
      instance: d.instance,
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
      project: d.project,
      instance: d.instance,
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
