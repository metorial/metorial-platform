export let detag = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  let raw = strings.reduce((out, str, i) => {
    let value = i < values.length ? String(values[i] ?? '') : '';
    return out + str + value;
  }, '');

  let lines = raw.replace(/\r\n/g, '\n').split('\n');

  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  let indents = lines
    .filter(line => line.trim() !== '')
    .map(line => line.match(/^[ \t]*/)?.[0].length ?? 0);

  let minIndent = indents.length ? Math.min(...indents) : 0;

  return lines.map(line => line.slice(minIndent).replace(/[ \t]+$/g, '')).join('\n');
};
