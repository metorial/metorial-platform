export let parseCsv = (text: string): string[][] => {
  let rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    let char = text[i]!;

    if (quoted) {
      if (char == '"') {
        if (text[i + 1] == '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char == '"' && field == '') {
      quoted = true;
    } else if (char == ',') {
      row.push(field);
      field = '';
    } else if (char == '\n' || char == '\r') {
      if (char == '\r' && text[i + 1] == '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field != '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

let escapeField = (value: string) =>
  /[",\r\n]/.test(value) || value != value.trim() ? `"${value.replace(/"/g, '""')}"` : value;

export let serializeCsv = (rows: string[][], trailingNewline: boolean) => {
  let text = rows.map(row => row.map(escapeField).join(',')).join('\n');
  return trailingNewline && rows.length ? `${text}\n` : text;
};

export let normalizeCsvRows = (rows: string[][]) => {
  let width = Math.max(1, ...rows.map(row => row.length));
  return rows.map(row =>
    row.length == width ? row : [...row, ...Array(width - row.length).fill('')]
  );
};
