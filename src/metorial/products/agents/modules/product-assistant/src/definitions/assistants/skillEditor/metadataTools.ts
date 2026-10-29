import type { AuditScope } from '@metorial/audit-scope';
import type { Instance, Project } from '@metorial/db';
import { skillService } from '@metorial/module-skill';
import { jsonSchema, tool, type Tool } from 'ai';
import type { AssistantAccess } from '../../../lib/definitions';
import type { SkillEditorRequest } from './context';

let clientNamePattern = /^(?!-)(?!.*--)[a-z0-9-]+(?<!-)$/;

type MetadataInput = {
  name?: string;
  description?: string;
  clientName?: string;
  clientDescription?: string;
};

let getErrorMessage = (error: unknown) => {
  if (error && typeof error == 'object') {
    let data = (error as { data?: { message?: unknown } }).data;
    if (typeof data?.message == 'string') return data.message;
    if ('message' in error && typeof error.message == 'string') return error.message;
  }
  return String(error);
};

export let createSkillMetadataTools = (d: {
  request: SkillEditorRequest;
  project: Project;
  instance: Instance;
  access: AssistantAccess & { auditScope: AuditScope };
}) => {
  let tools: Record<string, Tool> = {};

  let update = async (input: MetadataInput) => {
    let { name, description, clientName, clientDescription } = input;

    if (clientName !== undefined && !clientNamePattern.test(clientName)) {
      return {
        error:
          'clientName must use lowercase alphanumeric characters or hyphens, cannot start or end with a hyphen, and cannot contain consecutive hyphens.'
      };
    }
    if (name !== undefined && !name.trim()) return { error: 'name must not be empty' };
    if (clientDescription !== undefined && !clientDescription.trim()) {
      return { error: 'clientDescription must not be empty' };
    }

    try {
      let skill = await skillService.getSkillById({
        project: d.project,
        instance: d.instance,
        skillId: d.request.skillId,
        accessTags:
          d.access.authorization.type == 'restricted' ? d.access.accessTags : undefined
      });

      let updated = await skillService.updateSkill({
        project: d.project,
        instance: d.instance,
        auditScope: d.access.auditScope,
        skill,
        authorization: d.access.authorization,
        defaultPermissions: d.access.defaultPermissions,
        overridePermissions: d.access.overridePermissions,
        input: {
          name: name?.trim(),
          description: description?.trim(),
          clientName,
          clientDescription: clientDescription?.trim()
        }
      });

      return {
        ok: true,
        name: updated.name,
        description: updated.description,
        clientName: updated.clientName,
        clientDescription: updated.clientDescription
      };
    } catch (error) {
      return { error: getErrorMessage(error) };
    }
  };

  if (d.request.mode == 'metadata') {
    tools.write_client_description = tool({
      description:
        'Save the client description of this skill. This is what agents read to decide whether to load the skill. Call it exactly once.',
      inputSchema: jsonSchema<{ clientDescription: string }>({
        type: 'object',
        properties: {
          clientDescription: {
            type: 'string',
            description:
              'What the skill does and when to use it, in 1-3 sentences, at most 1024 characters.'
          }
        },
        required: ['clientDescription'],
        additionalProperties: false
      }),
      execute: async ({ clientDescription }) =>
        await update({ clientDescription: clientDescription.slice(0, 1024) })
    });
  }

  if (d.request.mode == 'skill' || d.request.mode == 'document') {
    tools.update_skill_metadata = tool({
      description:
        "Update the skill's own fields: its display name and description, and the client name and client description that agents see when discovering the skill. Only pass the fields that should change.",
      inputSchema: jsonSchema<MetadataInput>({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Display name of the skill' },
          description: { type: 'string', description: 'Internal description of the skill' },
          clientName: {
            type: 'string',
            description:
              'Name agents see: lowercase letters, numbers and single hyphens, e.g. "pdf-processing"'
          },
          clientDescription: {
            type: 'string',
            description:
              'What the skill does and when an agent should use it, at most 1024 characters'
          }
        },
        additionalProperties: false
      }),
      execute: async input => {
        if (
          input.name === undefined &&
          input.description === undefined &&
          input.clientName === undefined &&
          input.clientDescription === undefined
        ) {
          return { error: 'Pass at least one field to update' };
        }
        return await update({
          ...input,
          clientDescription: input.clientDescription?.slice(0, 1024)
        });
      }
    });
  }

  return tools;
};
