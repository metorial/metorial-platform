import {
  badRequestError,
  createError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { once } from '@lowerdeck/once';
import { v, type ValidationType, type ValidationTypeValue } from '@lowerdeck/validation';
import type {
  RequestScopedTool,
  RequestScopedTools
} from '@metorial-subspace/module-connection';
import { consumerSessionInclude, resolveConsumerProfileAccess } from '@metorial/consumer-auth';
import type { Context } from '@metorial/context';
import { db, type ConsumerProfile, type Instance } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { flagService } from '@metorial/module-flags';
import {
  skillFileService,
  skillService,
  type SkillFile,
  type SkillFileChange,
  type SkillFileChangeResult
} from '@metorial/module-skill';
import { consumerSkillService } from '../services/consumerSkill';

let maxInlineReadBytes = 256 * 1024;
let maxListedSkills = 100;
let ifMatchAbsent = 'absent';

let listToolKey = 'metorial_skill_list';
let createToolKey = 'metorial_skill_create';
let getToolKey = 'metorial_skill_get';
let readFileToolKey = 'metorial_skill_read_file';
let writeFileToolKey = 'metorial_skill_write_file';
let deleteFileToolKey = 'metorial_skill_delete_file';
let moveFileToolKey = 'metorial_skill_move_file';

export type SkillEditingTools = RequestScopedTools &
  Required<Pick<RequestScopedTools, 'redactForLog'>>;

let skillProperty = { type: 'string', description: 'The skill ID or slug' };

let ifMatchEtagProperty = {
  type: 'string',
  description: 'The etag returned when the file was read'
};

let listInputValidator = v.object({
  search: v.optional(v.string())
});

let createInputValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  template_id: v.optional(v.string())
});

let skillInputValidator = v.object({
  skill: v.string()
});

let readFileInputValidator = v.object({
  skill: v.string(),
  path: v.string()
});

let writeFileInputValidator = v.object({
  skill: v.string(),
  path: v.string(),
  content: v.string(),
  if_match: v.optional(v.string())
});

let deleteFileInputValidator = v.object({
  skill: v.string(),
  path: v.string(),
  if_match: v.optional(v.string())
});

let moveFileInputValidator = v.object({
  skill: v.string(),
  path: v.string(),
  to_path: v.string(),
  if_match: v.optional(v.string())
});

let listTool: RequestScopedTool = {
  key: listToolKey,
  name: 'Metorial: list skills',
  description:
    'List the Metorial skills you have access to. A skill is a folder of files with a root /SKILL.md.',
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      search: {
        type: 'string',
        description: 'Optional text to filter skills by name or description'
      }
    }
  },
  readOnly: true
};

let createTool: RequestScopedTool = {
  key: createToolKey,
  name: 'Metorial: create skill',
  description: 'Create a new Metorial skill. It starts with a /SKILL.md you can then edit.',
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      name: { type: 'string', description: 'The name of the new skill' },
      description: {
        type: 'string',
        description: 'A short description of what the skill does'
      },
      template_id: {
        type: 'string',
        description: 'Optional skill template to start from'
      }
    }
  }
};

let getTool: RequestScopedTool = {
  key: getToolKey,
  name: 'Metorial: get skill',
  description: 'Get a skill and the list of its files with their sizes and etags.',
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['skill'],
    properties: { skill: skillProperty }
  },
  readOnly: true
};

let readFileTool: RequestScopedTool = {
  key: readFileToolKey,
  name: 'Metorial: read skill file',
  description: [
    'Read a file of a skill. Returns the content and the etag to pass as if_match when changing the file.',
    `Files larger than ${maxInlineReadBytes / 1024} KB cannot be read inline. Binary files are reported with binary: true and no content.`
  ].join('\n\n'),
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['skill', 'path'],
    properties: {
      skill: skillProperty,
      path: {
        type: 'string',
        description:
          'Path of the file inside the skill, for example /SKILL.md or references/api.md'
      }
    }
  },
  readOnly: true
};

let writeFileTool: RequestScopedTool = {
  key: writeFileToolKey,
  name: 'Metorial: write skill file',
  description: [
    'Create or replace a text file of a skill. Markdown files become collaboratively editable documents. Pass the etag from metorial_skill_read_file as if_match.',
    'Pass if_match "absent" when creating a file that must not exist yet. If the write fails because the file changed, read it again, merge your edits and retry.'
  ].join('\n\n'),
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['skill', 'path', 'content'],
    properties: {
      skill: skillProperty,
      path: { type: 'string', description: 'Path of the file inside the skill' },
      content: { type: 'string', description: 'The complete new text content of the file' },
      if_match: {
        type: 'string',
        description:
          'The etag returned when the file was read, or "absent" if the file must not exist yet'
      }
    }
  }
};

let deleteFileTool: RequestScopedTool = {
  key: deleteFileToolKey,
  name: 'Metorial: delete skill file',
  description: 'Delete a file of a skill. The root /SKILL.md cannot be deleted.',
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['skill', 'path'],
    properties: {
      skill: skillProperty,
      path: { type: 'string', description: 'Path of the file to delete' },
      if_match: ifMatchEtagProperty
    }
  },
  destructive: true
};

let moveFileTool: RequestScopedTool = {
  key: moveFileToolKey,
  name: 'Metorial: move skill file',
  description: 'Move or rename a file of a skill. The root /SKILL.md cannot be moved.',
  inputJsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['skill', 'path', 'to_path'],
    properties: {
      skill: skillProperty,
      path: { type: 'string', description: 'Current path of the file' },
      to_path: { type: 'string', description: 'New path of the file' },
      if_match: ifMatchEtagProperty
    }
  }
};

let validateInput = <V extends ValidationType<any>>(
  validator: V,
  input: unknown
): ValidationTypeValue<V> => {
  let result = validator.validate(input ?? {});
  if (!result.success) {
    throw new ServiceError(
      badRequestError({
        code: 'invalid_tool_input',
        message: 'Invalid tool input',
        errors: result.errors
      })
    );
  }

  return result.value;
};

let parseWriteIfMatch = (value?: string) => {
  let trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed === ifMatchAbsent) return null;

  return trimmed;
};

let parseEtag = (value?: string) => {
  let trimmed = value?.trim();
  if (trimmed === ifMatchAbsent) {
    throw new ServiceError(
      badRequestError({
        message: 'if_match "absent" only applies to writes; pass the etag of the file instead'
      })
    );
  }

  return trimmed || undefined;
};

let explainFileChanged = (error: unknown): never => {
  if (isServiceError(error) && error.data.code === 'skill_file_changed') {
    throw new ServiceError(
      createError({
        ...error.data,
        message: `${error.data.message}; read it again, merge your edits and retry`
      })
    );
  }

  throw error;
};

let redactForLog: SkillEditingTools['redactForLog'] = d => {
  let input = d.input;
  if (d.key === writeFileToolKey && input && typeof input === 'object' && 'content' in input) {
    let content = (input as { content: unknown }).content;
    input = {
      ...input,
      content: {
        bytes: typeof content === 'string' ? new TextEncoder().encode(content).length : 0
      }
    };
  }

  let output = d.output;
  if (d.key === readFileToolKey && output && 'content' in output) {
    let { content, binary: _binary, ...rest } = output;
    output = {
      ...rest,
      content_redacted: true,
      ...(typeof content === 'string'
        ? { content_bytes: new TextEncoder().encode(content).length }
        : {})
    };
  }

  return { input, output };
};

let presentSkill = (skill: {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
}) => ({
  id: skill.id,
  name: skill.name,
  slug: skill.slug,
  description: skill.description
});

let presentFile = (file: SkillFile) => ({
  path: file.path,
  kind: file.kind,
  size: file.size,
  etag: file.etag
});

let presentChange = (change: SkillFileChangeResult) => ({
  type: change.type,
  path: change.path,
  previous_path: change.previousPath,
  file: change.file ? presentFile(change.file) : null
});

export let createSkillEditingTools = async (d: {
  instance: Pick<Instance, 'oid'>;
  consumerProfile: Pick<ConsumerProfile, 'oid'>;
  skillPluginOid?: bigint | null;
  context: Context;
}): Promise<SkillEditingTools | null> => {
  let consumerProfile = await db.consumerProfile.findUnique({
    where: { oid: d.consumerProfile.oid },
    select: {
      instanceOid: true,
      status: true,
      surface: {
        select: {
          status: true,
          allowConsumerSkillAuthoring: true,
          portal: { select: { status: true } }
        }
      }
    }
  });
  if (
    !consumerProfile ||
    consumerProfile.instanceOid !== d.instance.oid ||
    consumerProfile.status !== 'active' ||
    consumerProfile.surface.status !== 'active' ||
    (consumerProfile.surface.portal && consumerProfile.surface.portal.status !== 'active')
  ) {
    return null;
  }

  let instance = await db.instance.findUniqueOrThrow({
    where: { oid: d.instance.oid },
    include: { organization: true, project: true }
  });

  let skillsEnabled = await flagService.isFlagEnabledForScope({
    organization: instance.organization,
    project: instance.project,
    flag: 'skills-enabled'
  });
  if (!skillsEnabled) return null;

  let canCreateSkills =
    !d.skillPluginOid && consumerProfile.surface.allowConsumerSkillAuthoring;

  let getAccess = once(async () => {
    let [fullConsumerProfile, pluginSkills] = await Promise.all([
      db.consumerProfile.findUniqueOrThrow({
        where: { oid: d.consumerProfile.oid },
        include: consumerSessionInclude.consumerProfile.include
      }),
      d.skillPluginOid
        ? db.skillPluginSkill.findMany({
            where: {
              skillPluginOid: d.skillPluginOid,
              status: 'active',
              skillPlugin: { status: 'active' }
            },
            select: { skill: { select: { id: true } } }
          })
        : null
    ]);
    let project = instance.project;

    let consumerAccess = await resolveConsumerProfileAccess({
      consumerProfile: fullConsumerProfile,
      organization: instance.organization,
      project,
      instance,
      context: d.context
    });

    return {
      scope: { project, instance },
      organization: instance.organization,
      consumerProfile: fullConsumerProfile,
      consumerGroups: consumerAccess.consumerGroups,
      accessTags: consumerAccess.accessTags,
      auditScope: consumerAccess.auditScope,
      pluginSkillIds: pluginSkills ? new Set(pluginSkills.map(entry => entry.skill.id)) : null,
      authorization: createResourceAuthorization({
        restricted: true,
        resourceActor: consumerAccess.resourceActor,
        accessTags: consumerAccess.accessTags,
        project,
        instance,
        consumerProfile: fullConsumerProfile
      })
    };
  });

  let resolveSkill = async (reference: string) => {
    let identifier = reference.trim();
    if (!identifier) {
      throw new ServiceError(badRequestError({ message: 'The skill argument is required' }));
    }

    let access = await getAccess();

    let skill = await skillService.getSkillById({
      ...access.scope,
      skillId: identifier,
      accessTags: access.accessTags
    });
    if (access.pluginSkillIds && !access.pluginSkillIds.has(skill.id)) {
      throw new ServiceError(notFoundError('skill', identifier));
    }

    return { access, skill };
  };

  let applyFileChange = async (reference: string, change: SkillFileChange) => {
    let { access, skill } = await resolveSkill(reference);

    let result = await skillFileService
      .applySkillFileChange({
        ...access.scope,
        auditScope: access.auditScope,
        skill,
        authorization: access.authorization,
        change
      })
      .catch(explainFileChanged);

    return presentChange(result);
  };

  let listSkills = async (input: { search?: string }) => {
    let access = await getAccess();
    if (access.pluginSkillIds?.size === 0) return { skills: [] };

    let paginator = await skillService.listSkills({
      ...access.scope,
      search: input.search,
      ids: access.pluginSkillIds ? [...access.pluginSkillIds] : undefined,
      accessTags: access.accessTags
    });
    let list = await paginator.run({ limit: maxListedSkills });

    let records = await db.skill.findMany({
      where: { id: { in: list.items.map(item => item.id) } },
      select: { id: true, name: true, slug: true, description: true }
    });
    let recordsById = new Map(records.map(record => [record.id, record]));

    return {
      skills: list.items.flatMap(item => {
        let record = recordsById.get(item.id);
        return record ? [presentSkill(record)] : [];
      })
    };
  };

  let createSkill = async (input: ValidationTypeValue<typeof createInputValidator>) => {
    let access = await getAccess();

    let skill = await consumerSkillService.createConsumerSkill({
      ...access.scope,
      organization: access.organization,
      auditScope: access.auditScope,
      consumerSurface: access.consumerProfile.surface,
      consumerProfile: access.consumerProfile,
      consumerGroups: access.consumerGroups,
      input: {
        name: input.name,
        description: input.description,
        templateId: input.template_id
      }
    });

    return presentSkill(skill);
  };

  let getSkill = async (input: ValidationTypeValue<typeof skillInputValidator>) => {
    let { access, skill } = await resolveSkill(input.skill);

    let files = await skillFileService.listSkillFiles({
      ...access.scope,
      skill,
      authorization: access.authorization
    });

    return { skill: presentSkill(skill), files: files.map(presentFile) };
  };

  let readFile = async (input: ValidationTypeValue<typeof readFileInputValidator>) => {
    let { access, skill } = await resolveSkill(input.skill);

    let file = await skillFileService.readSkillFileText({
      ...access.scope,
      skill,
      authorization: access.authorization,
      path: input.path,
      maxBytes: maxInlineReadBytes
    });

    return {
      path: file.path,
      kind: file.kind,
      size: file.size,
      etag: file.etag,
      binary: file.content === null,
      ...(file.content === null ? {} : { content: file.content })
    };
  };

  let call = async (key: string, rawInput: unknown): Promise<Record<string, any>> => {
    switch (key) {
      case listToolKey:
        return await listSkills(validateInput(listInputValidator, rawInput));

      case createToolKey:
        if (!canCreateSkills) break;
        return await createSkill(validateInput(createInputValidator, rawInput));

      case getToolKey:
        return await getSkill(validateInput(skillInputValidator, rawInput));

      case readFileToolKey:
        return await readFile(validateInput(readFileInputValidator, rawInput));

      case writeFileToolKey: {
        let input = validateInput(writeFileInputValidator, rawInput);

        return await applyFileChange(input.skill, {
          type: 'put',
          path: input.path,
          content: input.content,
          ifMatch: parseWriteIfMatch(input.if_match)
        });
      }

      case deleteFileToolKey: {
        let input = validateInput(deleteFileInputValidator, rawInput);

        return await applyFileChange(input.skill, {
          type: 'delete',
          path: input.path,
          ifMatch: parseEtag(input.if_match)
        });
      }

      case moveFileToolKey: {
        let input = validateInput(moveFileInputValidator, rawInput);

        return await applyFileChange(input.skill, {
          type: 'move',
          path: input.path,
          toPath: input.to_path,
          ifMatch: parseEtag(input.if_match)
        });
      }
    }

    throw new ServiceError(badRequestError({ message: `Unknown tool ${key}` }));
  };

  return {
    tools: [
      listTool,
      ...(canCreateSkills ? [createTool] : []),
      getTool,
      readFileTool,
      writeFileTool,
      deleteFileTool,
      moveFileTool
    ],
    call,
    redactForLog
  };
};
