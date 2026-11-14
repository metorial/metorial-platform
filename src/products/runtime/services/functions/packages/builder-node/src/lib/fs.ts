import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

export let readJsonFile = async <T>(inPath: string): Promise<T> => {
  let content = await fs.readFile(path.join(process.cwd(), inPath), 'utf-8');
  return JSON.parse(content) as T;
};

export let readJsonFileOptional = async <T>(inPath: string): Promise<T | null> => {
  if (!(await fileExists(inPath))) {
    return null;
  }

  return readJsonFile<T>(inPath);
};

export let fileExists = async (inPath: string): Promise<boolean> => {
  try {
    await fs.access(path.join(process.cwd(), inPath));
    return true;
  } catch {
    return false;
  }
};

export let fileExistsSync = (inPath: string): boolean => {
  try {
    fsSync.accessSync(path.join(process.cwd(), inPath));
    return true;
  } catch {
    return false;
  }
};
