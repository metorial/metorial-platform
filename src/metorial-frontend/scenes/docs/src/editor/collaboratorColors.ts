let collaboratorColors = [
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#dc2626',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#be123c'
];

export let getCollaboratorColor = (seed: string) => {
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return collaboratorColors[hash % collaboratorColors.length]!;
};
