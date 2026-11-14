export let safeParse = (json: string) => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};
