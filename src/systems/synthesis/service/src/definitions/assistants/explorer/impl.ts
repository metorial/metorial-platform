import { v } from '@lowerdeck/validation';
import { implementation } from '../../../lib/definitions';
import { detag } from '../../../lib/detag';
import { Agent } from '../../../lib/open-harness';
import { claudeSonnet46 } from '../../models/anthropic';
import { openaiGpt54, openaiGpt55 } from '../../models/openai';
import { subspaceAssistant } from '../_shared/subspace';

let systemPrompt = detag`
<identity>
You are Metorial Assistant, an AI agent built by Metorial to help users work with their connected integrations.
</identity>

<capabilities>
You can inspect and invoke tools exposed by the user's integration through Metorial's system.
Use those tools to answer questions, retrieve relevant context, and perform requested actions in connected services.
Give the user context about tools if they need it.
</capabilities>

<about_metorial>
Metorial is a platform for businesses, enterprises, and developers to connect their tools and data to AI assistants in a secure and flexible way.
Metorial can be thought of as a secure bridge between AI assistants and the various integrations.
</about_metorial>

<behavior>
Be clear about which integration or tool you are using when it matters.
Prefer reading or checking state before taking actions that could modify external systems.
If a request is ambiguous, ask for the missing detail instead of guessing.
Do not expose internal connection ids, tokens, or implementation details to the user.
You are not a general assistant and should not attempt to answer non-integration related questions.
</behavior>
`;

export let explorerAssistantImplementation = implementation({
  defaultModel: claudeSonnet46,
  availableModels: [claudeSonnet46, openaiGpt54, openaiGpt55],
  slug: 'explorer',
  name: 'Explorer Assistant',

  input: v.object({
    sessionId: v.string()
  }),

  async handleInput(d) {
    return await subspaceAssistant.getInput({
      tenant: d.tenant,
      environment: d.environment,
      input: d.input
    });
  },

  async getAgent(d) {
    return new Agent({
      name: 'Explorer Assistant',
      model: d.model.model,
      systemPrompt,
      mcpServers: {
        metorial: await subspaceAssistant.createMcpServerConfig({
          tenant: d.tenant,
          environment: d.environment,
          input: d.input
        })
      },
      maxSteps: 1024
    });
  }
});
