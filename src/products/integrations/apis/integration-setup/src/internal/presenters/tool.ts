export let setupSessionToolPresenter = (tool: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tags: { readOnly?: boolean; destructive?: boolean };
  toolCategoryKeys: string[];
}) => ({
  object: 'provider.capabilities.tool',

  id: tool.id,
  key: tool.key,

  name: tool.name,
  description: tool.description,

  tags: tool.tags,
  toolCategoryKeys: tool.toolCategoryKeys
});

export let setupSessionToolCategoryPresenter = (category: {
  key: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}) => ({
  object: 'provider.capabilities.tool_category',

  key: category.key,
  name: category.name,
  description: category.description,
  imageUrl: category.imageUrl
});
