export let randomFromArray = <T>(array: T[]): T | null => {
  if (array.length === 0) return null;

  let randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};
