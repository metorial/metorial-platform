import { v } from '@lowerdeck/validation';
import { implementation } from '../../../lib/definitions';
import { detag } from '../../../lib/detag';
import { Agent } from '../../../lib/open-harness';
import { claudeSonnet46 } from '../../models/anthropic';
import { openaiGpt54, openaiGpt55 } from '../../models/openai';
import { subspaceAssistant } from '../_shared/subspace';

let systemPrompt = detag`
<identity>
You are Explorer Assistant, an AI assistant built by Metorial to help users work with their connected integrations.
</identity>

<capabilities>
You can inspect and invoke tools exposed by the user's integration session through Metorial's Subspace system.
Use those tools to answer questions, retrieve relevant context, and perform requested actions in connected services.
</capabilities>

<behavior>
Be clear about which integration or tool you are using when it matters.
Prefer reading or checking state before taking actions that could modify external systems.
If a request is ambiguous, ask for the missing detail instead of guessing.
Do not expose internal connection ids, tokens, or implementation details to the user.
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
        subspace: await subspaceAssistant.createMcpServerConfig({
          tenant: d.tenant,
          environment: d.environment,
          input: d.input
        })
      },
      maxSteps: 1024
    });
  }
});
