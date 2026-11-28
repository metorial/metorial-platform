import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { getLastUsed } from '@metorial/module-agent-tracking-query';
import {
  aiToolPolicyService,
  aiToolPolicyStatuses,
  type AiToolSummary
} from '@metorial/module-consumer-core';
import { aiToolPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getAiToolActivity } from '../../../lib/aiToolActivity';
import { aiToolDetectionFlags } from '../../../lib/aiToolDetection';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { requireParam } from '../../../lib/requireParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let maxNoteLength = 1000;

let aiToolFlags = hasFlags(aiToolDetectionFlags);

let presentAiTool = async (
  ctx: Parameters<typeof getAiToolActivity>[0],
  aiTool: AiToolSummary
) => {
  let activity = await getAiToolActivity(ctx, { toolKeys: [aiTool.tool.key] });

  return aiToolPresenter.present({
    aiTool,
    telemetry: getLastUsed(activity, aiTool.tool.key)
  });
};

export let aiToolController = Controller.create(
  {
    name: 'AI Tools',
    description:
      'An AI tool is an assistant, coding agent or local model runner that Metorial Desktop can find on enrolled devices. Each tool is sanctioned, not sanctioned or unreviewed per instance.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('ai-tools', 'aiTools.list'), {
        name: 'List AI tools',
        description:
          'Returns every AI tool in the detection catalog with its approval status and how many devices and people have it, most widely found first. The list is not paginated.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(aiToolFlags)
      .query(
        'default',
        v.object({
          policy_status: v.optional(
            v.union(
              [v.enumOf(aiToolPolicyStatuses), v.array(v.enumOf(aiToolPolicyStatuses))],
              {
                name: 'policy_status',
                description:
                  'Only return tools with these approval statuses. Pass `not_sanctioned` and `unreviewed` to list shadow AI.'
              }
            )
          ),
          detected: v.optional(
            v.boolean({
              name: 'detected',
              description:
                'When `true`, only return tools found on at least one signed-in device. When `false`, only tools found on none.'
            })
          )
        })
      )
      .outputList(aiToolPresenter)
      .do(async ctx => {
        let aiTools = await aiToolPolicyService.listTools({
          instance: ctx.instance,
          policyStatuses: normalizeArrayParam(ctx.query.policy_status),
          detected: ctx.query.detected
        });
        let activity = await getAiToolActivity(ctx, {
          toolKeys: aiTools.map(aiTool => aiTool.tool.key)
        });

        return Paginator.present(
          { items: aiTools, pagination: { hasNextPage: false, hasPreviousPage: false } },
          aiTool =>
            aiToolPresenter.present({
              aiTool,
              telemetry: getLastUsed(activity, aiTool.tool.key)
            })
        );
      }),

    get: instanceGroup
      .get(instancePath('ai-tools/:toolKey', 'aiTools.get'), {
        name: 'Get AI tool',
        description: 'Retrieves an AI tool with its approval status and usage in the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:read'] }))
      .use(aiToolFlags)
      .output(aiToolPresenter)
      .do(async ctx => {
        let aiTool = await aiToolPolicyService.getTool({
          instance: ctx.instance,
          toolKey: requireParam(ctx.params, 'toolKey')
        });

        return await presentAiTool(ctx, aiTool);
      }),

    updatePolicy: instanceGroup
      .patch(instancePath('ai-tools/:toolKey/policy', 'aiTools.policy.update'), {
        name: 'Update AI tool policy',
        description:
          'Sanctions an AI tool for the instance, or marks it not sanctioned or unreviewed. Omitted fields keep their current value. Devices are not changed; the status only labels what they report.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.consumers:write'] }))
      .use(aiToolFlags)
      .body(
        'default',
        v.object({
          status: v.optional(
            v.enumOf(aiToolPolicyStatuses, {
              name: 'status',
              description:
                '`sanctioned` approves the tool, `not_sanctioned` marks it as shadow AI, `unreviewed` withdraws the decision.'
            })
          ),
          note: v.optional(
            v.nullable(
              v.string({
                name: 'note',
                description: `Why the tool was approved or not, up to ${maxNoteLength} characters. \`null\` clears it.`,
                modifiers: [v.maxLength(maxNoteLength)]
              })
            )
          )
        })
      )
      .output(aiToolPresenter)
      .do(async ctx => {
        let aiTool = await aiToolPolicyService.updatePolicy({
          instance: ctx.instance,
          toolKey: requireParam(ctx.params, 'toolKey'),
          auditScope: ctx.auditScope,
          input: { status: ctx.body.status, note: ctx.body.note }
        });

        return await presentAiTool(ctx, aiTool);
      })
  }
);
