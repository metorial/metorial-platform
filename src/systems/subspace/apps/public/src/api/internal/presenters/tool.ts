export let setupSessionToolPresenter = (tool: {
  id: string;
  key: string;
  name: string;
  description: string | null;
}) => ({
  object: 'provider.capabilities.tool',

  id: tool.id,
  key: tool.key,

  name: tool.name,
  description: tool.description
});
