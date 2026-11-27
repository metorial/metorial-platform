export let markdownList = (title: string, items: string[]) => {
  if (items.length === 0) return '';

  return [`## ${title}`, ...items.filter(Boolean).map(i => `* ${i}`)].join('\n');
};
