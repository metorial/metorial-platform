export let argsTs = `let currentArgs = {current: null};

export let setArgs = (args: any) => {
  currentArgs.current = args;
};

export let getArgs = () => {
  return currentArgs.current;
};
`;
