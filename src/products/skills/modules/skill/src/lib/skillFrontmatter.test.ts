import { describe, expect, it } from 'vitest';
import {
  getSkillAgentName,
  normalizeSkillAgentName,
  parseSkillDocumentFrontmatter,
  renderSkillDocumentFrontmatter
} from './skillFrontmatter';

let skill = {
  name: 'Refund Desk',
  clientName: null,
  description: 'Handles refunds',
  clientDescription: null,
  license: null,
  compatibility: null,
  clientMetadata: null
};

describe('renderSkillDocumentFrontmatter', () => {
  it('adds frontmatter from the skill to a document without any', () => {
    let rendered = renderSkillDocumentFrontmatter('# Refunds\n', { skill });

    expect(parseSkillDocumentFrontmatter(rendered)).toEqual({
      frontmatter: { name: 'refund-desk', description: 'Handles refunds', metadata: {} },
      body: '\n# Refunds\n',
      hasFrontmatter: true
    });
  });

  it('overrides the name and keeps the fields the author wrote', () => {
    let rendered = renderSkillDocumentFrontmatter(
      '---\nname: old\ndescription: Written by the author\nallowed-tools: Bash\n---\nBody\n',
      { skill, name: 'refunds' }
    );

    let { frontmatter, body } = parseSkillDocumentFrontmatter(rendered);

    expect(frontmatter).toEqual({
      name: 'refunds',
      description: 'Written by the author',
      'allowed-tools': 'Bash',
      metadata: {}
    });
    expect(body).toBe('Body\n');
  });

  it('quotes strings that YAML 1.1 parsers would read as booleans or dates', () => {
    let rendered = renderSkillDocumentFrontmatter(
      '---\ndescription: "yes"\nreleased: "2024-01-01"\n---\nBody\n',
      { skill }
    );

    expect(rendered).toContain('description: "yes"');
    expect(rendered).toContain('released: "2024-01-01"');
    expect(parseSkillDocumentFrontmatter(rendered).frontmatter).toMatchObject({
      description: 'yes',
      released: '2024-01-01'
    });
  });

  it('renders the same bytes every time', () => {
    let content = '---\ndescription: x\n---\nBody\n';

    expect(renderSkillDocumentFrontmatter(content, { skill })).toBe(
      renderSkillDocumentFrontmatter(content, { skill })
    );
  });
});

describe('skill agent names', () => {
  it('derives a valid name from the skill', () => {
    expect(getSkillAgentName({ name: 'Refund Desk', clientName: null })).toBe('refund-desk');
    expect(getSkillAgentName({ name: 'Ignored', clientName: 'pdf_tools' })).toBe('pdf-tools');
  });

  it.each([
    ['--Leading and trailing--', 'leading-and-trailing'],
    ['a  --  b', 'a-b'],
    ['日本語', 'skill'],
    ['x'.repeat(80), 'x'.repeat(64)]
  ])('normalizes %s', (input, expected) => {
    expect(normalizeSkillAgentName(input)).toBe(expected);
  });

  it('never ends with a hyphen after truncation', () => {
    expect(normalizeSkillAgentName(`${'a'.repeat(63)}-b`)).toBe('a'.repeat(63));
  });
});
