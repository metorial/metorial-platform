import type { ParsedSource } from '../sources/fetch';

export class ExtractionError extends Error {
  constructor(
    public source: string,
    public problems: string[]
  ) {
    super(`${source}: extraction aborted: ${problems.join('; ')}`);
    this.name = 'ExtractionError';
  }
}

export let extractData = <T>(
  source: string,
  run: (d: {
    add: (record: T) => void;
    flag: (problem: string) => void;
    skip: (reason: string) => void;
    row: (label: string, extract: () => void) => void;
    abort: (problem: string) => never;
  }) => void
): ParsedSource<T[]> => {
  let data: T[] = [];
  let problems: string[] = [];
  let issues: string[] = [];
  let abort = (problem: string): never => {
    throw new ExtractionError(source, [problem]);
  };

  try {
    run({
      add: record => {
        data.push(record);
      },
      flag: problem => {
        problems.push(problem);
      },
      skip: reason => {
        issues.push(`${source}: ${reason}`);
      },
      abort,
      row: (label, extract) => {
        try {
          extract();
        } catch (error) {
          problems.push(`${label}: ${(error as Error).message}`);
        }
      }
    });
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    abort((error as Error).message);
  }

  if (!data.length) problems.push('no supported pricing rows found');
  if (problems.length) throw new ExtractionError(source, problems);
  return { data, issues };
};
