export let getExpiresIn = (expiresAt?: Date | null) => {
  if (!expiresAt) return undefined;

  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
};
