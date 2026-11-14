// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { markdownToDoc } from './markdownParser';
import {
  headlessSchema,
  jsdomParsesLikeSpec,
  legacyMarkdownToJSON
} from './testing/legacyMarkdown';
import { createRandom, mutatedDocument, structuredDocument } from './testing/fuzz';

let seed = Number(process.env.FUZZ_SEED ?? 0x2f6e2b1);
let iterations = Number(process.env.FUZZ_ITERATIONS ?? 300);
let timeout = 1_800_000;

let schema = headlessSchema();

let outcome = (run: () => unknown) => {
  try {
    return JSON.stringify(run());
  } catch (error) {
    return `error:${(error as Error).name}`;
  }
};

let findMismatches = async (generate: (random: () => number) => string) => {
  let random = createRandom(seed);
  let mismatches: string[] = [];
  let compared = 0;

  for (let i = 0; i < iterations; i++) {
    let markdown = generate(random);
    if (!(await jsdomParsesLikeSpec(markdown))) continue;

    compared++;
    let expected = outcome(() => legacyMarkdownToJSON(markdown));
    let actual = outcome(() => markdownToDoc(markdown, schema).toJSON());

    if (expected !== actual) mismatches.push(markdown);
  }

  return { compared, mismatches: mismatches.slice(0, 3) };
};

describe('markdown parser fuzz parity', () => {
  it(
    `matches the DOM-based pipeline on ${iterations} structured documents`,
    async () => {
      let result = await findMismatches(structuredDocument);

      expect(result.mismatches).toEqual([]);
      expect(result.compared).toBeGreaterThan(iterations * 0.8);
    },
    timeout
  );

  it(
    `matches the DOM-based pipeline on ${iterations} mutated documents`,
    async () => {
      let result = await findMismatches(mutatedDocument);

      expect(result.mismatches).toEqual([]);
      expect(result.compared).toBeGreaterThan(iterations * 0.6);
    },
    timeout
  );
});
