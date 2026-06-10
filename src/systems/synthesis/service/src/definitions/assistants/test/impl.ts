import { createSandbox, implementation } from '../../../lib/definitions';
import { detag } from '../../../lib/detag';
import { Agent } from '../../../lib/open-harness';
import { baseSystemPrompt } from '../../implementations/_systemPrompt';
import {
  claudeHaiku45,
  claudeOpus45,
  claudeOpus46,
  claudeOpus47,
  claudeSonnet45,
  claudeSonnet46,
  cohereCommandA,
  deepseekR1,
  deepseekV3,
  deepseekV31,
  deepseekV31Terminus,
  deepseekV32,
  deepseekV32Thinking,
  deepseekV4Flash,
  googleGemini31FlashLitePreview,
  googleGemini31ProPreview,
  googleGemini3Flash,
  googleGemini3ProPreview,
  googleGemma426bA4bIt,
  metaLlama3170b,
  metaLlama318b,
  metaLlama3211b,
  metaLlama321b,
  metaLlama323b,
  metaLlama3290b,
  metaLlama3370b,
  metaLlama4Maverick,
  metaLlama4Scout,
  mistralCodestral,
  mistralLarge3,
  mistralMedium,
  mistralMinistral14b,
  moonshotaiKimiK2,
  moonshotaiKimiK25,
  moonshotaiKimiK26,
  moonshotaiKimiK2Thinking,
  moonshotaiKimiK2ThinkingTurbo,
  moonshotaiKimiK2Turbo,
  openaiGpt52,
  openaiGpt52Chat,
  openaiGpt52Codex,
  openaiGpt52Pro,
  openaiGpt53Chat,
  openaiGpt53Codex,
  openaiGpt54,
  openaiGpt54Mini,
  openaiGpt54Nano,
  openaiGpt54Pro,
  openaiGpt55,
  openaiGpt55Pro,
  openaiGptOss120b,
  openaiGptOss20b,
  xaiGrok4,
  xaiGrok41FastNonReasoning,
  xaiGrok41FastReasoning,
  xaiGrok420MultiAgent,
  xaiGrok420MultiAgentBeta,
  xaiGrok420NonReasoning,
  xaiGrok420NonReasoningBeta,
  xaiGrok420Reasoning,
  xaiGrok420ReasoningBeta,
  xaiGrok43,
  xaiGrok4FastNonReasoning,
  xaiGrok4FastReasoning
} from '../../models';
import { webSearchTools } from '../../tools/webSearch';

let systemPrompt = detag`
${baseSystemPrompt}

<environment>
You have access to a container for running shell commands and managing files.
</environment>

<capabilities>
* You may search the web to gather information relevant to the user's request. Focus on finding recent and relevant information.
</capabilities>

<response>
After you're done processing the user's request, making file modifications, running commands, and running tools, you MUST respond with a short summary of what you did.
Don't focus on individual commands/tools you used, instead focus on the overall outcome and which files you modified.
</response>
`;

export let testAssistantImplementation = implementation({
  defaultModel: claudeSonnet46,
  availableModels: [
    claudeSonnet45,
    claudeSonnet46,
    claudeHaiku45,
    claudeOpus45,
    claudeOpus46,
    claudeOpus47,
    openaiGpt52,
    openaiGpt52Chat,
    openaiGpt52Codex,
    openaiGpt52Pro,
    openaiGpt53Chat,
    openaiGpt53Codex,
    openaiGpt54,
    openaiGpt54Mini,
    openaiGpt54Nano,
    openaiGpt54Pro,
    openaiGpt55,
    openaiGpt55Pro,
    openaiGptOss120b,
    openaiGptOss20b,
    cohereCommandA,
    deepseekR1,
    deepseekV3,
    deepseekV31,
    deepseekV31Terminus,
    deepseekV32,
    deepseekV32Thinking,
    deepseekV4Flash,
    googleGemini3Flash,
    googleGemini3ProPreview,
    googleGemini31FlashLitePreview,
    googleGemini31ProPreview,
    googleGemma426bA4bIt,
    metaLlama3170b,
    metaLlama318b,
    metaLlama3211b,
    metaLlama321b,
    metaLlama323b,
    metaLlama3290b,
    metaLlama3370b,
    metaLlama4Maverick,
    metaLlama4Scout,
    mistralCodestral,
    mistralMinistral14b,
    mistralLarge3,
    mistralMedium,
    moonshotaiKimiK2,
    moonshotaiKimiK2Thinking,
    moonshotaiKimiK2ThinkingTurbo,
    moonshotaiKimiK2Turbo,
    moonshotaiKimiK25,
    moonshotaiKimiK26,
    xaiGrok4,
    xaiGrok4FastNonReasoning,
    xaiGrok4FastReasoning,
    xaiGrok41FastNonReasoning,
    xaiGrok41FastReasoning,
    xaiGrok420MultiAgent,
    xaiGrok420MultiAgentBeta,
    xaiGrok420NonReasoning,
    xaiGrok420NonReasoningBeta,
    xaiGrok420Reasoning,
    xaiGrok420ReasoningBeta,
    xaiGrok43
  ],
  slug: 'test',
  name: 'Test Assistant',

  async getAgent(d) {
    let sandbox = await createSandbox();

    return new Agent({
      name: 'Test Assistant',
      model: d.model.model,
      systemPrompt,
      filesystem: sandbox.fs,
      tools: {
        ...sandbox.tools,
        ...webSearchTools
      },
      maxSteps: 1024
    });
  }
});
