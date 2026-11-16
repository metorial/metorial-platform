import { gzipSync } from 'node:zlib';
import type { ResolvedField } from '../catalog';

export type ExportFormat = 'csv' | 'ndjson';

export type ExportColumn = { header: string; field: string; label: boolean };

export type ExportLabels = Record<string, Record<string, Record<string, string | null>>>;

let formulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];

export let exportExtensions: Record<ExportFormat, string> = {
  csv: 'csv.gz',
  ndjson: 'ndjson.gz'
};

export let exportColumnsOf = (fields: ResolvedField[], labels: boolean): ExportColumn[] =>
  fields.flatMap(field => [
    { header: field.name, field: field.name, label: false },
    ...(labels && field.label
      ? [{ header: `${field.name}.name`, field: field.name, label: true }]
      : [])
  ]);

let labelOf = (labels: ExportLabels, column: ExportColumn, value: unknown) => {
  let names = (Array.isArray(value) ? value : [value])
    .filter(id => typeof id == 'string')
    .map(id => labels[column.field]?.[id as string]?.name ?? null);
  if (!names.some(name => name !== null)) return null;

  return Array.isArray(value) ? names.map(name => name ?? '') : names[0];
};

let cellValue = (row: Record<string, unknown>, column: ExportColumn, labels: ExportLabels) => {
  let value = row[column.field];
  return column.label ? labelOf(labels, column, value) : value;
};

// Telemetry (entity and tool names) can contain anything, so text that a spreadsheet would read as
// a formula is defused with a leading quote. Numbers are never prefixed.
export let csvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';

  let text: string;
  if (Array.isArray(value))
    text = value
      .map(item => (item === null || item === undefined ? '' : String(item)))
      .join(';');
  else if (typeof value == 'object') text = JSON.stringify(value);
  else text = String(value);

  if (
    typeof value != 'number' &&
    typeof value != 'boolean' &&
    formulaPrefixes.some(prefix => text.startsWith(prefix))
  ) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;

  return text;
};

export let serializeRows = (d: {
  format: ExportFormat;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  labels: ExportLabels;
  header: boolean;
}) => {
  if (d.format == 'ndjson') {
    return d.rows
      .map(
        row =>
          JSON.stringify(
            Object.fromEntries(
              d.columns.map(column => [
                column.header,
                cellValue(row, column, d.labels) ?? null
              ])
            )
          ) + '\n'
      )
      .join('');
  }

  let lines = d.rows.map(row =>
    d.columns.map(column => csvCell(cellValue(row, column, d.labels))).join(',')
  );
  if (d.header) lines.unshift(d.columns.map(column => csvCell(column.header)).join(','));

  return lines.map(line => `${line}\r\n`).join('');
};

// Every chunk is its own gzip member. Concatenated members form a valid gzip file (RFC 1952), so
// parts can be compressed, retried and replaced independently.
export let gzipMember = (text: string) => gzipSync(Buffer.from(text, 'utf8'));
