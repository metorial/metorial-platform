export let linearGradient = (angle: number, ...colors: string[]) => {
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};
