export let externalImages = (recipe: string) => {
  let stages = new Set(['scratch']);
  let references = new Set<string>();
  for (let line of recipe.split('\n')) {
    let from = line.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
    let copy = line.match(/^COPY\s+--from=(\S+)/i);
    let reference = from?.[1] ?? copy?.[1];
    if (reference && !stages.has(reference.toLowerCase()) && !/^\d+$/.test(reference)) {
      if (reference.includes('$'))
        throw new Error(`Dynamic external image requires explicit resolution: ${reference}`);
      references.add(reference);
    }
    if (from?.[2]) stages.add(from[2].toLowerCase());
  }
  let syntax = recipe.match(/^# syntax=(\S+)/m)?.[1];
  if (syntax) references.add(syntax);
  return [...references];
};
