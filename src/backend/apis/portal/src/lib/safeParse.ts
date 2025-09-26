export let safeParse = (str: string | null) => {
  try {
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
};
