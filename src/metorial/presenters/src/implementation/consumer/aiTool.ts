import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { type AiToolTelemetry, aiToolType } from '../../types';
import { aiToolSurfacesSchema } from './consumerDeviceDetection';

export let aiToolPolicyStatusValues = ['sanctioned', 'not_sanctioned', 'unreviewed'] as const;

export let activeUseWindowDays = 30;

export let presentActiveUse = (running: boolean, telemetry: AiToolTelemetry | null) => ({
  actively_used: running || (telemetry ? !!telemetry.lastUsedAt : null),
  last_used_at: telemetry?.lastUsedAt ?? null
});

export let aiToolPolicyStatusDescription =
  '`sanctioned` tools are approved for use, `not_sanctioned` tools are not. Tools nobody has decided on yet are `unreviewed`.';

export let v1AiToolPresenter = Presenter.create(aiToolType)
  .presenter(async ({ aiTool: { tool, policy, usage }, telemetry }) => ({
    object: 'ai_tool' as const,
    key: tool.key,
    name: tool.name,
    description: tool.description,
    maker: { id: tool.maker.id, name: tool.maker.name },
    website: tool.website,
    surfaces: tool.surfaces,

    policy: {
      status: policy?.status ?? ('unreviewed' as const),
      note: policy?.note ?? null,
      decided_at: policy?.decidedAt ?? null
    },

    device_count: usage?.deviceCount ?? 0,
    people_count: usage?.peopleCount ?? 0,
    last_seen_at: usage?.lastSeenAt ?? null,

    ...presentActiveUse(!!usage?.running, telemetry)
  }))
  .schema(
    v.object({
      object: v.literal('ai_tool', { description: 'String representing the object’s type.' }),
      key: v.string({
        name: 'key',
        description:
          'Catalog key of the AI tool. Use it in place of an ID in paths and filters.',
        examples: ['claude-code', 'ollama']
      }),
      name: v.string({ name: 'name', description: 'Display name.' }),
      description: v.string({ name: 'description', description: 'Free-text description.' }),
      maker: v.object(
        {
          id: v.string({ name: 'id', description: 'Unique ID.', examples: ['anthropic'] }),
          name: v.string({ name: 'name', description: 'Display name.' })
        },
        { name: 'maker', description: 'Company or project that makes the tool.' }
      ),
      website: v.nullable(v.string({ name: 'website', description: 'Product website.' })),
      surfaces: aiToolSurfacesSchema,
      policy: v.object(
        {
          status: v.enumOf([...aiToolPolicyStatusValues], {
            name: 'status',
            description: aiToolPolicyStatusDescription
          }),
          note: v.nullable(
            v.string({
              name: 'note',
              description: 'Why the tool was approved or not, as the admin wrote it.'
            })
          ),
          decided_at: v.nullable(
            v.date({
              name: 'decided_at',
              description: 'When the status was last changed. `null` while nobody has decided.'
            })
          )
        },
        { name: 'policy', description: 'Whether the tool is approved in this instance.' }
      ),
      device_count: v.number({
        name: 'device_count',
        description: 'Signed-in devices whose latest detection report lists the tool.'
      }),
      people_count: v.number({
        name: 'people_count',
        description: 'Consumers with at least one of those devices.'
      }),
      last_seen_at: v.nullable(
        v.date({
          name: 'last_seen_at',
          description: 'When a device last reported the tool. `null` when no device has.'
        })
      ),
      actively_used: v.nullable(
        v.boolean({
          name: 'actively_used',
          description: `\`true\` when a device reports the tool running or agent usage tracking saw it used in the last ${activeUseWindowDays} days, \`false\` when neither happened. \`null\` when no device reports it running and its usage is unknown: agent usage tracking is off, AI tool detection is off, you can't read agent usage, or agent usage tracking cannot answer.`
        })
      ),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: `When agent usage tracking last saw the tool in use in the last ${activeUseWindowDays} days. \`null\` when it saw no use or its usage is unknown.`
        })
      )
    })
  )
  .build();
