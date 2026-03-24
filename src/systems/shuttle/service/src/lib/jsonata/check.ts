import { processJsonata } from './process';

export let checkJsonata = async (expression: string) => {
  try {
    await processJsonata(expression, {});
    return true;
  } catch (e) {
    return false;
  }
};
