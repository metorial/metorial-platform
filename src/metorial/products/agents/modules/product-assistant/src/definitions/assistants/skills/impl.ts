import { createSandbox, implementation } from '../../../lib/definitions';
import { detag } from '../../../lib/detag';
import { Agent } from '../../../lib/open-harness';
import { baseSystemPrompt } from '../../implementations/_systemPrompt';
import { claudeSonnet46 } from '../../models/anthropic';
import { webSearchTools } from '../../tools/webSearch';

let systemPrompt = () => detag`
${baseSystemPrompt()}

<environment>
You have access to a container for running shell commands and managing files.
</environment>

<capabilities>
* You may search the web to gather information relevant to the user's request. Focus on finding recent and relevant information.
* You should modify SKILLS files or add new SKILLS based on the user's request. Skills are located in the /skills directory.
</capabilities>

<response>
After you're done processing the user's request, making file modifications, running commands, and running tools, you MUST respond with a short summary of what you did.
Don't focus on individual commands/tools you used, instead focus on the overall outcome and which files you modified.
</response>
`;

export let skillsAssistantImplementation = implementation({
  defaultModel: claudeSonnet46,
  availableModels: [claudeSonnet46],
  slug: 'skills',
  name: 'Skills Assistant',

  async getAgent(d) {
    let sandbox = await createSandbox();

    return new Agent({
      name: 'Skills Assistant',
      model: d.model.model,
      systemPrompt: systemPrompt(),
      filesystem: sandbox.fs,
      tools: {
        ...sandbox.tools,
        ...webSearchTools
      },
      maxSteps: 1024
    });
  }
});
