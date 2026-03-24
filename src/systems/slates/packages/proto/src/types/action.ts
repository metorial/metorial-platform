import z from 'zod';

export let slatesActionBase = z.object({
  id: z.string(),

  name: z.string(),
  description: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  tags: z
    .object({
      destructive: z.boolean().optional(),
      readOnly: z.boolean().optional()
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),

  inputSchema: z.record(z.string(), z.any()),
  outputSchema: z.record(z.string(), z.any())
});

export let slatesActionTool = slatesActionBase.extend({
  type: z.literal('action.tool'),
  capabilities: z.object({})
});

export let slatesActionTrigger = slatesActionBase.extend({
  type: z.literal('action.trigger'),
  capabilities: z.object({}),

  invocation: z.union([
    z.object({
      type: z.literal('polling'),
      intervalSeconds: z.number().min(60 * 10)
    }),
    z.object({
      type: z.literal('webhook'),
      autoRegistration: z.boolean(),
      autoUnregistration: z.boolean()
    })
  ])
});

export let slatesAction = z.union([slatesActionTool, slatesActionTrigger]);

export type SlatesAction = z.infer<typeof slatesAction>;
export type SlatesActionTool = z.infer<typeof slatesActionTool>;
export type SlatesActionTrigger = z.infer<typeof slatesActionTrigger>;
