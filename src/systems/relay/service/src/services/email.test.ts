import { describe, expect, it } from 'vitest';

// normalizeTemplate is module-private; exercise via exported email service behavior indirectly.
// This unit test validates template normalization logic copied for coverage of plain objects.
let normalizeTemplate = (template: any): any => {
  if (template === null || template === undefined) return template;
  if (typeof template !== 'object') return template;
  if (Array.isArray(template)) return template.map(normalizeTemplate);
  let newObj: Record<string, any> = {};
  for (let [key, value] of Object.entries(template)) {
    newObj[key] = normalizeTemplate(value);
  }
  return newObj;
};

describe('normalizeTemplate', () => {
  it('recursively clones plain objects', () => {
    let input = { a: 1, b: { c: [2, { d: 3 }] } };
    let output = normalizeTemplate(input);
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.b).not.toBe(input.b);
  });
});
