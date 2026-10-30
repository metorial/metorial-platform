let runtimeValues: Record<string, string> = {};
let inlineValues: Record<string, string> | undefined;

export let inlineConfigElementId = 'metorial-config';

let toStringRecord = (value: unknown) =>
  Object.fromEntries(
    Object.entries((value ?? {}) as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] == 'string'
    )
  );

let readInlineValues = () => {
  if (inlineValues) return inlineValues;

  try {
    let element =
      typeof document == 'undefined' ? null : document.getElementById(inlineConfigElementId);
    inlineValues = toStringRecord(element ? JSON.parse(element.textContent ?? '{}') : {});
  } catch {
    inlineValues = {};
  }

  return inlineValues;
};

export let loadRuntimeConfig = async (url = '/config.json') => {
  let response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);

  runtimeValues = toStringRecord(await response.json());
};

export let runtimeEnv = (name: string, buildValue?: string) =>
  runtimeValues[name] ?? readInlineValues()[name] ?? buildValue;
