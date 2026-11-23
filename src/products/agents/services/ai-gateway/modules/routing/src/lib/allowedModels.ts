// Entries are exact names (`anthropic/claude-sonnet-5`, `openai:gpt-6`) or a trailing-`*` prefix
// (`anthropic/*`). The requested name and the resolved model slug are both checked, so a token
// allowing `anthropic/*` also accepts an alias like `claude-sonnet-latest`.
export let isModelAllowed = (d: {
  allowedModels: string[];
  requested: string;
  modelSlug: string;
}) => {
  if (!d.allowedModels.length) return true;

  let candidates = [d.requested.trim().toLowerCase(), d.modelSlug.toLowerCase()];

  return d.allowedModels.some(entry => {
    let pattern = entry.trim().toLowerCase();
    if (pattern == '*') return true;

    if (pattern.endsWith('*')) {
      let prefix = pattern.slice(0, -1);
      return candidates.some(candidate => candidate.startsWith(prefix));
    }

    return candidates.includes(pattern);
  });
};
