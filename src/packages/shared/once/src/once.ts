export let once = <Res>(fn: () => Res): (() => Res) => {
  let called = false;
  let result: Res;

  return (): Res => {
    if (!called) {
      called = true;
      result = fn();
    }

    return result;
  };
};
