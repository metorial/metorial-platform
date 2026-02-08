export let buildArguments = (
  obj: Record<string, string | number | boolean | (string | number)[]>
) => {
  let cmd: string[] = [];

  for (let [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      for (let item of value) {
        cmd.push(`--${key}`, `${item}`);
      }
    } else if (typeof value === 'boolean') {
      if (value) cmd.push(`--${key}`);
    } else if (typeof value === 'number' || typeof value === 'string') {
      cmd.push(`--${key}`, `${value}`);
    }
  }

  return cmd;
};
