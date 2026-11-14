import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../src/lib/markdown';

let md1In = fs.readFileSync(path.join(__dirname, '__fixtures__', 'md1.in'), 'utf-8');
let md2In = fs.readFileSync(path.join(__dirname, '__fixtures__', 'md2.in'), 'utf-8');

describe('renderMarkdown', () => {
  it('should render markdown correctly 1', async () => {
    let rendered = await Markdown.from(md1In, {
      id: 'test-id'
    }).toHtml();

    expect(rendered).toMatchSnapshot();
  });

  it('should render markdown correctly 2', async () => {
    let rendered = await Markdown.from(md2In, {
      id: 'test-id',
      linkRoot: 'https://github.com/comet-ml/opik/blob/main',
      imageRoot: 'https://raw.githubusercontent.com/comet-ml/opik/refs/heads/main'
    }).toHtml();

    expect(rendered).toMatchSnapshot();
  });

  it('should render markdown to markdown 1', async () => {
    let rendered = await Markdown.from(md1In, {
      id: 'test-id'
    }).toMarkdown();

    expect(rendered).toMatchSnapshot();
  });

  it('should render markdown to markdown 2', async () => {
    let rendered = await Markdown.from(md2In, {
      id: 'test-id',
      linkRoot: 'https://github.com/comet-ml/opik/blob/main',
      imageRoot: 'https://raw.githubusercontent.com/comet-ml/opik/refs/heads/main'
    }).toMarkdown();

    expect(rendered).toMatchSnapshot();
  });
});
