import { Cases } from './cases';

type ConvertFn = (key: string) => string;

let convertKeysRecursive = <T>(obj: T, convertFn: ConvertFn): T => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => convertKeysRecursive(item, convertFn)) as T;
  if (typeof obj !== 'object') return obj;

  let result: Record<string, unknown> = {};
  for (let key of Object.keys(obj)) {
    let newKey = convertFn(key);
    result[newKey] = convertKeysRecursive((obj as Record<string, unknown>)[key], convertFn);
  }
  return result as T;
};

export let convertKeysToCamelCase = <T>(obj: T): T =>
  convertKeysRecursive(obj, Cases.toCamelCase);

export let convertKeysToSnakeCase = <T>(obj: T): T =>
  convertKeysRecursive(obj, Cases.toSnakeCase);
