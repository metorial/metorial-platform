export let libArgsTs = `
export let setArgs = (args: any) => {
  globalThis.__metorial_setArgs__(args);
};

export let getArgs = async () => {
  return await globalThis.__metorial_getArgs__();
};
`;
