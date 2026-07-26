export let normalizeEmailAddress = (email: string | null | undefined) => {
  let normalized = email?.trim().replace(/^<|>$/g, '').toLowerCase();
  if (!normalized || !/^[^@\s<>]+@[^@\s<>]+$/.test(normalized)) return '';
  return normalized;
};
