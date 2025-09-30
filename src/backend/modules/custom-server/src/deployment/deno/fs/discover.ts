export let discoverTs = `import type { Client } from '@modelcontextprotocol/sdk/client';
import type { Prompt, ResourceTemplate, Tool } from '@modelcontextprotocol/sdk/types.js';

export let discover = async (client: Client) => {
  let tools: Tool[] = [];
  let resourceTemplates: ResourceTemplate[] = [];
  let prompts: Prompt[] = [];

  try {
    let toolsRes = await client.listTools();
    tools.push(...toolsRes.tools);
    while (toolsRes.nextPageToken) {
      toolsRes = await client.listTools({ pageToken: toolsRes.nextPageToken });
      tools.push(...toolsRes.tools);
    }
  } catch (e) {}

  try {
    let resourceTemplatesRes = await client.listResourceTemplates();
    resourceTemplates.push(...resourceTemplatesRes.resourceTemplates);
    while (resourceTemplatesRes.nextPageToken) {
      resourceTemplatesRes = await client.listResourceTemplates({
        pageToken: resourceTemplatesRes.nextPageToken
      });
      resourceTemplates.push(...resourceTemplatesRes.resourceTemplates);
    }
  } catch (e) {}

  try {
    let promptsRes = await client.listPrompts();
    prompts.push(...promptsRes.prompts);
    while (promptsRes.nextPageToken) {
      promptsRes = await client.listPrompts({ pageToken: promptsRes.nextPageToken });
      prompts.push(...promptsRes.prompts);
    }
  } catch (e) {}

  return {
    tools,
    resourceTemplates,
    prompts,
    instructions: client.getInstructions(),
    capabilities: client.getServerCapabilities(),
    implementation: client.getServerVersion()
  };
};
`;
