let initialisms = new Set([
  'ACL',
  'API',
  'ASCII',
  'CIDR',
  'CPU',
  'CSS',
  'DNS',
  'EOF',
  'GUID',
  'HTML',
  'HTTP',
  'HTTPS',
  'ID',
  'IP',
  'JSON',
  'JWT',
  'MB',
  'MCP',
  'OS',
  'QPS',
  'RAM',
  'RPC',
  'SHA256',
  'SLA',
  'SMTP',
  'SQL',
  'SSH',
  'TCP',
  'TLS',
  'TTL',
  'UDP',
  'UI',
  'URI',
  'URL',
  'UTF8',
  'UUID',
  'VM',
  'XML'
]);

export let words = (input: string) =>
  input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

let capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export let pascalCase = (input: string) => words(input).map(capitalize).join('');

export let camelCase = (input: string) => {
  let pascal = pascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

export let goName = (input: string) =>
  words(input)
    .map(word => (initialisms.has(word.toUpperCase()) ? word.toUpperCase() : capitalize(word)))
    .join('');

export let goParamName = (input: string) => {
  let parts = words(input);
  let [first, ...rest] = parts;
  if (!first) return 'value';

  let name = first.toLowerCase() + rest.map(word => goName(word)).join('');
  return goKeywords.has(name) ? `${name}Value` : name;
};

export let goKeywords = new Set([
  'break',
  'case',
  'chan',
  'const',
  'continue',
  'default',
  'defer',
  'else',
  'fallthrough',
  'for',
  'func',
  'go',
  'goto',
  'if',
  'import',
  'interface',
  'map',
  'package',
  'range',
  'return',
  'select',
  'struct',
  'switch',
  'type',
  'var',
  'ctx',
  'opts',
  'in',
  'c',
  'err'
]);
