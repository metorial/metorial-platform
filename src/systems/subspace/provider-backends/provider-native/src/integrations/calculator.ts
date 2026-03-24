import { createIntegration, createTool, z } from '../registry';

if (process.env.METORIAL_ENV !== 'production') {
  let addTool = createTool(
    {
      key: 'add',
      name: 'Add',
      description: 'Add two numbers.',
      input: z.object({
        a: z.number(),
        b: z.number()
      }),
      output: z.object({
        result: z.number()
      }),
      tags: {
        readOnly: true
      }
    },
    async input => ({
      result: input.a + input.b
    })
  );

  let subtractTool = createTool(
    {
      key: 'subtract',
      name: 'Subtract',
      description: 'Subtract one number from another.',
      input: z.object({
        a: z.number(),
        b: z.number()
      }),
      output: z.object({
        result: z.number()
      }),
      tags: {
        readOnly: true
      }
    },
    async input => ({
      result: input.a - input.b
    })
  );

  let multiplyTool = createTool(
    {
      key: 'multiply',
      name: 'Multiply',
      description: 'Multiply two numbers.',
      input: z.object({
        a: z.number(),
        b: z.number()
      }),
      output: z.object({
        result: z.number()
      }),
      tags: {
        readOnly: true
      }
    },
    async input => ({
      result: input.a * input.b
    })
  );

  let divideTool = createTool(
    {
      key: 'divide',
      name: 'Divide',
      description: 'Divide one number by another.',
      input: z.object({
        a: z.number(),
        b: z.number()
      }),
      output: z.object({
        result: z.number()
      }),
      tags: {
        readOnly: true
      }
    },
    async input => {
      if (input.b === 0) {
        throw new Error('Division by zero is not allowed');
      }

      return {
        result: input.a / input.b
      };
    }
  );

  createIntegration({
    identifier: 'calculator',
    name: 'Calculator',
    description: 'Test native integration with basic arithmetic tools.',
    readme: `
# Calculator

Native test integration that exposes basic arithmetic operations.

Available tools:
- \`add\`
- \`subtract\`
- \`multiply\`
- \`divide\`
`,
    tools: [addTool, subtractTool, multiplyTool, divideTool]
  });
}
