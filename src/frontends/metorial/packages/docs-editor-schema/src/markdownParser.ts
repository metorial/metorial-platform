/// <reference path="./markdownIt.d.ts" />
import { DOMParser, type Node as ProseMirrorNode, type Schema } from '@tiptap/pm/model';
import markdownit from 'markdown-it';
import taskListPlugin from 'markdown-it-task-lists';
import {
  HtmlElement,
  HtmlText,
  parseHtmlBody,
  reparseHtmlBody,
  type HtmlNode
} from './htmlDom';

// Markdown is rendered to HTML and parsed through the schema's parseDOM rules, which are the
// allowlist of accepted HTML. Nodes and marks below carry editor-only state that never
// round-trips through markdown, so HTML that merely imitates them loses the attribute that
// identifies it and is then treated as an unknown element.
let editorOnlyMarkers = [
  { selector: 'div[data-agent-block]', attribute: 'data-agent-block' },
  { selector: 'div[data-image-placeholder]', attribute: 'data-image-placeholder' },
  { selector: 'span[data-comment-thread]', attribute: 'data-comment-thread' }
];

let markdownOptions = {
  html: true,
  linkify: true,
  breaks: false,
  langPrefix: 'language-'
};

type RuleSet = { parser: DOMParser; blockSelector: string };

let ruleSets = new WeakMap<Schema, RuleSet>();

let withoutTrailingNewline =
  (renderer: (...args: any[]) => string) =>
  (...args: any[]) => {
    let rendered = renderer(...args);
    if (rendered === '\n') return rendered;
    return rendered.endsWith('\n') ? rendered.slice(0, -1) : rendered;
  };

let createMarkdownIt = () => {
  let md = markdownit(markdownOptions).use(taskListPlugin);

  md.renderer.rules.hardbreak = withoutTrailingNewline(md.renderer.rules.hardbreak!);
  md.renderer.rules.softbreak = withoutTrailingNewline(md.renderer.rules.softbreak!);
  md.renderer.rules.fence = withoutTrailingNewline(md.renderer.rules.fence!);
  md.renderer.rules.code_block = withoutTrailingNewline(md.renderer.rules.code_block!);
  md.renderer.renderToken = withoutTrailingNewline(md.renderer.renderToken.bind(md.renderer));

  return md;
};

let markdownIt = createMarkdownIt();

let getRuleSet = (schema: Schema): RuleSet => {
  let cached = ruleSets.get(schema);
  if (cached) return cached;

  let blockSelector = Object.values(schema.nodes)
    .filter(type => type.isBlock)
    .flatMap(type => (type.spec.parseDOM ?? []).map(rule => rule.tag))
    .filter((tag): tag is string => !!tag)
    .join(',');

  let ruleSet = { parser: DOMParser.fromSchema(schema), blockSelector };
  ruleSets.set(schema, ruleSet);
  return ruleSet;
};

let extractFromParent = (element: HtmlElement) => {
  let parent = element.parentNode!;
  let grandparent = parent.parentNode!;
  let before = parent.cloneNode();

  while (parent.firstChild && parent.firstChild !== element)
    before.appendChild(parent.firstChild);

  if (before.firstChild) grandparent.insertBefore(before, parent);
  grandparent.insertBefore(element, parent);
  if (!parent.firstChild) parent.remove();
};

let isTextNode = (node: HtmlNode | null): node is HtmlText => node instanceof HtmlText;

let neutralizeEditorOnlyElements = (body: HtmlElement) => {
  for (let { selector, attribute } of editorOnlyMarkers) {
    for (let element of body.querySelectorAll(selector)) element.removeAttribute(attribute);
  }
};

let markTaskLists = (body: HtmlElement) => {
  for (let list of body.querySelectorAll('.contains-task-list')) {
    list.setAttribute('data-type', 'taskList');
  }

  for (let item of body.querySelectorAll('.task-list-item')) {
    let input = item.querySelector('input');
    item.setAttribute('data-type', 'taskItem');

    if (input) {
      item.setAttribute('data-checked', String(input.hasAttribute('checked')));
      input.remove();
    }
  }
};

let hoistBlocksOutOfParagraphs = (body: HtmlElement, blockSelector: string) => {
  if (!blockSelector) return;

  for (let element of body.querySelectorAll(blockSelector)) {
    if (element.parentElement?.matches('p')) extractFromParent(element);
  }
};

let stripRenderedLineBreaks = (body: HtmlElement) => {
  for (let element of body.querySelectorAll('*')) {
    let next = element.nextSibling;
    if (isTextNode(next) && !element.closest('pre')) next.data = next.data.replace(/^\n/, '');
  }
};

export let renderMarkdownHtml = (markdown: string) => markdownIt.render(markdown);

export let markdownToDoc = (markdown: string, schema: Schema): ProseMirrorNode => {
  let { parser, blockSelector } = getRuleSet(schema);
  let body = parseHtmlBody(renderMarkdownHtml(markdown));

  neutralizeEditorOnlyElements(body);
  markTaskLists(body);
  hoistBlocksOutOfParagraphs(body, blockSelector);
  stripRenderedLineBreaks(body);

  return parser.parse(reparseHtmlBody(body) as unknown as Node);
};
