import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillMcpAvailabilityType } from '../../types';

export let v1SkillMcpAvailabilityPresenter = Presenter.create(skillMcpAvailabilityType)
  .presenter(async ({ skillMcpAvailability, skill }) => ({
    object: 'skill.mcp_availability' as const,

    skill_id: skill.id,
    available: skillMcpAvailability.available,
    exceeded_limits: skillMcpAvailability.exceededLimits,
    file_count: skillMcpAvailability.fileCount,
    size: skillMcpAvailability.size,
    max_file_count: skillMcpAvailability.maxFileCount,
    max_size: skillMcpAvailability.maxSize
  }))
  .schema(
    v.object({
      object: v.literal('skill.mcp_availability', {
        description: "String representing the object's type"
      }),
      skill_id: v.string({
        description: 'The ID of the skill.'
      }),
      available: v.boolean({
        description:
          'Whether apps connected over MCP can see the skill. Skills over a limit are left out of MCP connections but keep working everywhere else.'
      }),
      exceeded_limits: v.array(v.enumOf(['file_count', 'size']), {
        description: 'The limits the skill is over. Empty when the skill is available.'
      }),
      file_count: v.number({
        description: 'Number of files the skill would share over MCP.'
      }),
      size: v.number({
        description: 'Total size in bytes of the files the skill would share over MCP.'
      }),
      max_file_count: v.number({
        description: 'Most files a skill can have and still be shared over MCP.'
      }),
      max_size: v.number({
        description:
          'Largest total size in bytes a skill can have and still be shared over MCP.'
      })
    })
  )
  .build();
