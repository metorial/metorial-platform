let splitMany = (str: string, separators: string[]) => {
  let regex = new RegExp(separators.map(separator => `\\${separator}`).join('|'), 'g');
  return str.split(regex);
};

let humanizeCode = (code: string) =>
  splitMany(code, ['_', '-', '.', ' '])
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export let getErrorLabel = (code: string) => humanizeCode(code);
