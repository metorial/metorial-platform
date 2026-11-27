import {
  Fragment,
  type DOMOutputSpec,
  type Mark,
  type Node as ProseMirrorNode
} from '@tiptap/pm/model';

// tiptap-markdown serializes anything without a markdown equivalent through the DOM
// (document / window.DOMParser), which does not exist on the server. These specs render
// the same HTML straight from each extension's renderHTML output, so serialization
// behaves identically in the browser and in Node.

type MarkdownState = {
  write: (text: string) => void;
  ensureNewLine: () => void;
  closeBlock: (node: ProseMirrorNode) => void;
  renderInline: (node: ProseMirrorNode) => void;
  inTable?: boolean;
};

let voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr'
]);

// Line breaks are encoded because a blank line terminates a raw HTML block in markdown,
// which would let the remainder of a value be parsed as new markdown/HTML.
let escapeText = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('\u00a0', '&nbsp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\n', '&#10;');

let escapeAttribute = (value: string) => escapeText(value).replaceAll('"', '&quot;');

let localName = (name: string) => name.split(' ').pop() ?? name;

let renderOutputSpec = (
  spec: DOMOutputSpec,
  renderHole: () => string,
  wrapContent?: (inner: string) => string
): string => {
  if (typeof spec === 'string') return escapeText(spec);
  if (!Array.isArray(spec)) {
    throw new Error('Cannot serialize DOM nodes to HTML without a DOM');
  }

  let [rawTag, ...rest] = spec as readonly [string, ...any[]];
  let tag = localName(rawTag);
  let children = rest;
  let attributes = '';

  let first = rest[0];
  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    children = rest.slice(1);
    for (let [name, value] of Object.entries(first)) {
      if (value === null || value === undefined) continue;
      attributes += ` ${localName(name)}="${escapeAttribute(String(value))}"`;
    }
  }

  if (voidElements.has(tag)) return `<${tag}${attributes}>`;

  let inner = children
    .map(child => (child === 0 ? renderHole() : renderOutputSpec(child, renderHole)))
    .join('');

  return `<${tag}${attributes}>${wrapContent ? wrapContent(inner) : inner}</${tag}>`;
};

let renderMark = (mark: Mark, inner: string) => {
  let toDOM = mark.type.spec.toDOM;
  if (!toDOM) return inner;
  return renderOutputSpec(toDOM(mark, true), () => inner);
};

let renderNode = (node: ProseMirrorNode, wrapContent?: (inner: string) => string): string => {
  let html: string;
  if (node.isText) {
    html = escapeText(node.text ?? '');
  } else {
    let toDOM = node.type.spec.toDOM;
    if (!toDOM) throw new Error(`Cannot serialize node "${node.type.name}" to HTML`);
    html = renderOutputSpec(toDOM(node), () => renderFragment(node.content), wrapContent);
  }

  return node.marks.reduceRight((inner, mark) => renderMark(mark, inner), html);
};

let renderFragment = (fragment: Fragment) => {
  let html = '';
  fragment.forEach(child => {
    html += renderNode(child);
  });
  return html;
};

let serializeNodeAsHtml = (node: ProseMirrorNode, parent: ProseMirrorNode | Fragment) => {
  let isTopLevelBlock =
    node.isBlock &&
    (parent instanceof Fragment || parent.type.name === node.type.schema.topNodeType.name);

  return isTopLevelBlock
    ? renderNode(node, inner => (inner.trim() ? `\n${inner}\n` : '\n'))
    : renderNode(node);
};

let writeNodeAsHtml = (
  state: MarkdownState,
  node: ProseMirrorNode,
  parent: ProseMirrorNode | Fragment
) => {
  state.write(serializeNodeAsHtml(node, parent));
  if (node.isBlock) state.closeBlock(node);
};

let getMarkTags = (mark: Mark) => {
  let match = renderMark(mark, ' ').match(/^(<.*?>) (<\/.*?>)$/);
  return match ? [match[1]!, match[2]!] : null;
};

export let htmlMarkMarkdownSpec = {
  serialize: {
    open: (_state: MarkdownState, mark: Mark) => getMarkTags(mark)?.[0] ?? '',
    close: (_state: MarkdownState, mark: Mark) => getMarkTags(mark)?.[1] ?? ''
  },
  parse: {}
};

export let hardBreakMarkdownSpec = {
  serialize(
    state: MarkdownState,
    node: ProseMirrorNode,
    parent: ProseMirrorNode,
    index: number
  ) {
    for (let i = index + 1; i < parent.childCount; i++) {
      if (parent.child(i).type !== node.type) {
        state.write(state.inTable ? serializeNodeAsHtml(node, parent) : '\\\n');
        return;
      }
    }
  },
  parse: {}
};

let hasSpan = (cell: ProseMirrorNode) => cell.attrs.colspan > 1 || cell.attrs.rowspan > 1;

let isMarkdownSerializableTable = (table: ProseMirrorNode) => {
  let rows: ProseMirrorNode[] = [];
  table.forEach(row => rows.push(row));
  let [headerRow, ...bodyRows] = rows;
  if (!headerRow) return false;

  let headerIsValid = headerRow.children.every(
    cell => cell.type.name === 'tableHeader' && !hasSpan(cell) && cell.childCount <= 1
  );
  let bodyIsValid = bodyRows.every(row =>
    row.children.every(
      cell => cell.type.name !== 'tableHeader' && !hasSpan(cell) && cell.childCount <= 1
    )
  );

  return headerIsValid && bodyIsValid;
};

export let tableMarkdownSpec = {
  serialize(state: MarkdownState, node: ProseMirrorNode, parent: ProseMirrorNode | Fragment) {
    if (!isMarkdownSerializableTable(node)) {
      writeNodeAsHtml(state, node, parent);
      return;
    }

    state.inTable = true;
    node.forEach((row, _rowOffset, rowIndex) => {
      state.write('| ');
      row.forEach((cell, _cellOffset, cellIndex) => {
        if (cellIndex) state.write(' | ');
        let cellContent = cell.firstChild;
        if (cellContent?.textContent.trim()) state.renderInline(cellContent);
      });
      state.write(' |');
      state.ensureNewLine();

      if (rowIndex === 0) {
        let delimiterRow = Array.from({ length: row.childCount }, () => '---').join(' | ');
        state.write(`| ${delimiterRow} |`);
        state.ensureNewLine();
      }
    });
    state.closeBlock(node);
    state.inTable = false;
  },
  parse: {}
};
