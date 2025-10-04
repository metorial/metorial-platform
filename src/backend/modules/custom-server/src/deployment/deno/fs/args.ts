export let argsTs = `import { ProgrammablePromise } from './promise.ts';

let currentArgs = new ProgrammablePromise();

export let setArgs = (args: any) => {
  currentArgs.resolve(args);
};

export let getArgs = () => {
  return currentArgs.value;
};
`;
