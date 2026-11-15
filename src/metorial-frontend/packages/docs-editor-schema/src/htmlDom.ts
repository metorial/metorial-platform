import { parse, parseFragment, serialize } from 'parse5';
import { elementMatches } from './htmlSelector';

let maxHtmlDepth = 256;
let htmlNamespace = 'http://www.w3.org/1999/xhtml';

let mutationVersion = 0;

let asciiWhitespace = /[ \t\n\f\r]+/;

export class HtmlDepthError extends Error {
  constructor() {
    super(`Markdown contains HTML nested deeper than ${maxHtmlDepth} levels`);
    this.name = 'HtmlDepthError';
  }
}

let htmlDocument = {
  createTextNode: (data: string) => new HtmlText(data)
};

export abstract class HtmlNode {
  abstract nodeType: number;
  abstract nodeName: string;
  abstract textContent: string;

  parentNode: HtmlElement | null = null;
  previousSibling: HtmlNode | null = null;
  nextSibling: HtmlNode | null = null;

  get ownerDocument() {
    return htmlDocument;
  }

  get parentElement() {
    return this.parentNode;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }
}

export class HtmlText extends HtmlNode {
  nodeType = 3;
  nodeName = '#text';

  constructor(public data: string) {
    super();
  }

  get nodeValue() {
    return this.data;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value: string) {
    this.data = value;
  }
}

export class HtmlComment extends HtmlNode {
  nodeType = 8;
  nodeName = '#comment';

  constructor(public data: string) {
    super();
  }

  get textContent() {
    return '';
  }
}

let lengthPattern = /^[+-]?(\d+\.?\d*|\.\d+)(%|[a-z]+)?$/i;
let colorFunctionPattern = /^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^()]*\)$/i;
let hexColorPattern = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

let textDecorationTokens = new Set([
  'none',
  'underline',
  'overline',
  'line-through',
  'blink',
  'solid',
  'double',
  'dotted',
  'dashed',
  'wavy',
  'from-font',
  'auto'
]);

let verticalAlignKeywords = new Set([
  'baseline',
  'sub',
  'super',
  'top',
  'text-top',
  'middle',
  'bottom',
  'text-bottom'
]);

let textAlignKeywords = new Set([
  'start',
  'end',
  'left',
  'right',
  'center',
  'justify',
  'match-parent',
  'justify-all'
]);

let globalKeywords = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

let namedColors = new Set([
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'transparent',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
  'currentcolor'
]);

let splitTokens = (value: string) => value.match(/[^\s()]+(\([^()]*\))?/g) ?? [];

let isColorToken = (token: string) =>
  hexColorPattern.test(token) ||
  colorFunctionPattern.test(token) ||
  namedColors.has(token.toLowerCase());

// Only the declarations the editor schema reads are interpreted, each with a strict value
// grammar so that malformed values are dropped the way a browser drops them.
let styleNormalizers: Record<string, (value: string) => string | null> = {
  'font-weight': value => {
    let lower = value.toLowerCase();
    if (['normal', 'bold', 'bolder', 'lighter'].includes(lower)) return lower;
    if (!/^\+?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value)) return null;

    let weight = Number(value);
    return weight >= 1 && weight <= 1000 ? String(weight) : null;
  },
  'font-style': value => {
    let lower = value.toLowerCase();
    if (lower == 'normal' || lower == 'italic') return lower;
    return /^oblique(\s+[+-]?(\d+\.?\d*|\.\d+)(deg|grad|rad|turn))?$/.test(lower)
      ? lower
      : null;
  },
  'text-decoration': value => {
    let tokens = splitTokens(value);
    let valid =
      tokens.length > 0 &&
      tokens.every(
        token =>
          textDecorationTokens.has(token.toLowerCase()) ||
          lengthPattern.test(token) ||
          isColorToken(token)
      );

    return valid ? value.toLowerCase() : null;
  },
  'vertical-align': value => {
    let lower = value.toLowerCase();
    if (verticalAlignKeywords.has(lower)) return lower;
    if (/^[+-]?0*\.?0+$/.test(value)) return '0px';
    return lengthPattern.test(value) ? lower : null;
  },
  'text-align': value => (textAlignKeywords.has(value.toLowerCase()) ? value : null)
};

let normalizeDeclaration = (property: string, rawValue: string) => {
  let value = rawValue.replace(/\s*!\s*important\s*$/i, '').trim();
  if (!value) return null;
  if (globalKeywords.has(value.toLowerCase())) return value.toLowerCase();

  let normalize = styleNormalizers[property];
  return normalize ? normalize(value) : value;
};

class HtmlStyle {
  private declarations: [string, string][] = [];

  constructor(source: string | null) {
    for (let chunk of (source ?? '').split(';')) {
      let separator = chunk.indexOf(':');
      if (separator < 0) continue;

      let property = chunk.slice(0, separator).trim().toLowerCase();
      let value = property ? normalizeDeclaration(property, chunk.slice(separator + 1)) : null;
      if (value === null) continue;

      this.declarations = this.declarations.filter(([name]) => name != property);
      this.declarations.push([property, value]);
    }

    return new Proxy(this, {
      get: (target, key, receiver) => {
        if (typeof key != 'string' || key in target) return Reflect.get(target, key, receiver);
        return target.getPropertyValue(
          key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
        );
      }
    });
  }

  get length() {
    return this.declarations.length;
  }

  item(index: number) {
    return this.declarations[index]?.[0] ?? '';
  }

  getPropertyValue(name: string) {
    return this.declarations.find(([key]) => key == name.toLowerCase())?.[1] ?? '';
  }
}

export class HtmlElement extends HtmlNode {
  nodeType = 1;
  firstChild: HtmlNode | null = null;
  lastChild: HtmlNode | null = null;

  private attributes = new Map<string, string>();
  private queryCache = new Map<string, { version: number; result: HtmlElement[] }>();

  constructor(
    public localName: string,
    public namespaceURI: string = htmlNamespace
  ) {
    super();
  }

  get nodeName() {
    return this.localName.toUpperCase();
  }

  get tagName() {
    return this.nodeName;
  }

  get childNodes() {
    let nodes: HtmlNode[] = [];
    for (let child = this.firstChild; child; child = child.nextSibling) nodes.push(child);
    return nodes;
  }

  get children() {
    return this.childNodes.filter((node): node is HtmlElement => node instanceof HtmlElement);
  }

  get textContent(): string {
    return this.childNodes.map(child => child.textContent).join('');
  }

  set textContent(value: string) {
    for (let child of this.childNodes) this.removeChild(child);
    if (value) this.appendChild(new HtmlText(value));
  }

  get style() {
    return new HtmlStyle(this.getAttribute('style')) as HtmlStyle & Record<string, string>;
  }

  get firstElementChild() {
    return this.children[0] ?? null;
  }

  get classList() {
    let classes = (this.getAttribute('class') ?? '').split(asciiWhitespace).filter(Boolean);

    return {
      length: classes.length,
      contains: (name: string) => classes.includes(name),
      item: (index: number) => classes[index] ?? null,
      [Symbol.iterator]: () => classes[Symbol.iterator]()
    };
  }

  getAttribute(name: string) {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name.toLowerCase());
  }

  get attributeList() {
    return Array.from(this.attributes, ([name, value]) => ({ name, value }));
  }

  setAttribute(name: string, value: string) {
    mutationVersion++;
    this.attributes.set(name.toLowerCase(), String(value));
  }

  removeAttribute(name: string) {
    mutationVersion++;
    this.attributes.delete(name.toLowerCase());
  }

  matches(selector: string) {
    return elementMatches(this, selector);
  }

  closest(selector: string) {
    for (let element: HtmlElement | null = this; element; element = element.parentNode) {
      if (element.matches(selector)) return element;
    }

    return null;
  }

  querySelectorAll(selector: string) {
    let cached = this.queryCache.get(selector);
    if (cached?.version == mutationVersion) return [...cached.result];

    let found: HtmlElement[] = [];
    let visit = (parent: HtmlElement) => {
      for (let child = parent.firstChild; child; child = child.nextSibling) {
        if (!(child instanceof HtmlElement)) continue;
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };

    visit(this);
    this.queryCache.set(selector, { version: mutationVersion, result: found });
    return [...found];
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  contains(node: HtmlNode | null) {
    for (let current = node; current; current = current.parentNode) {
      if (current === this) return true;
    }

    return false;
  }

  appendChild<T extends HtmlNode>(child: T) {
    return this.insertBefore(child, null);
  }

  insertBefore<T extends HtmlNode>(child: T, reference: HtmlNode | null) {
    child.remove();
    mutationVersion++;

    let previous = reference ? reference.previousSibling : this.lastChild;
    child.parentNode = this;
    child.previousSibling = previous;
    child.nextSibling = reference;

    if (previous) previous.nextSibling = child;
    else this.firstChild = child;

    if (reference) reference.previousSibling = child;
    else this.lastChild = child;

    return child;
  }

  removeChild<T extends HtmlNode>(child: T) {
    mutationVersion++;
    if (child.previousSibling) child.previousSibling.nextSibling = child.nextSibling;
    else this.firstChild = child.nextSibling;

    if (child.nextSibling) child.nextSibling.previousSibling = child.previousSibling;
    else this.lastChild = child.previousSibling;

    child.parentNode = null;
    child.previousSibling = null;
    child.nextSibling = null;

    return child;
  }

  cloneNode() {
    let clone = new HtmlElement(this.localName, this.namespaceURI);
    for (let [name, value] of this.attributes) clone.attributes.set(name, value);
    return clone;
  }
}

type ParsedNode = {
  nodeName: string;
  value?: string;
  data?: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: ParsedNode[];
};

let convertParsedNode = (source: ParsedNode): HtmlNode | null => {
  if (source.nodeName == '#text') return new HtmlText(source.value ?? '');
  if (source.nodeName == '#comment') return new HtmlComment(source.data ?? '');
  if (!source.tagName) return null;

  let element = new HtmlElement(source.tagName, source.namespaceURI);
  for (let attribute of source.attrs ?? []) {
    if (!element.hasAttribute(attribute.name))
      element.setAttribute(attribute.name, attribute.value);
  }

  return element;
};

let convertParsedChildren = (root: ParsedNode) => {
  let body = new HtmlElement('body');
  let stack = [{ source: root, target: body, depth: 0 }];

  while (stack.length > 0) {
    let { source, target, depth } = stack.pop()!;
    if (depth > maxHtmlDepth) throw new HtmlDepthError();

    for (let childSource of source.childNodes ?? []) {
      let child = convertParsedNode(childSource);
      if (!child) continue;

      target.appendChild(child);
      if (child instanceof HtmlElement) {
        stack.push({ source: childSource, target: child, depth: depth + 1 });
      }
    }
  }

  return body;
};

let parseOptions = { scriptingEnabled: false };

let findBody = (document: ParsedNode) =>
  document.childNodes
    ?.find(node => node.tagName == 'html')
    ?.childNodes?.find(node => node.tagName == 'body') ?? null;

let serializeTreeAdapter = {
  getChildNodes: (node: HtmlElement) => node.childNodes,
  getParentNode: (node: HtmlNode) => node.parentNode,
  getTemplateContent: (node: HtmlElement) => node,
  getTagName: (node: HtmlElement) => node.localName,
  getNamespaceURI: (node: HtmlElement) => node.namespaceURI,
  getAttrList: (node: HtmlElement) => node.attributeList,
  getTextNodeContent: (node: HtmlText) => node.data,
  getCommentNodeContent: (node: HtmlComment) => node.data,
  getDocumentTypeNodeName: () => '',
  getDocumentTypeNodePublicId: () => '',
  getDocumentTypeNodeSystemId: () => '',
  isTextNode: (node: HtmlNode) => node instanceof HtmlText,
  isCommentNode: (node: HtmlNode) => node instanceof HtmlComment,
  isDocumentTypeNode: () => false,
  isElementNode: (node: HtmlNode) => node instanceof HtmlElement
};

// Imported documents were historically parsed through three passes: a body parse, an
// innerHTML round-trip, and a final parse that drops whitespace-only text nodes. The passes
// disagree on malformed HTML (an unclosed <p> before a <table>, text inside a <table>), and
// stored documents were imported through exactly that sequence, so the sequence is kept.
export let parseHtmlBody = (html: string) => {
  let document = parse(`<body>${html}</body>`, parseOptions) as unknown as ParsedNode;
  let bodySource = findBody(document);
  if (!bodySource) return new HtmlElement('body');

  let roundTripped = serialize(bodySource as never).replace(
    /\n<\/code><\/pre>/g,
    '</code></pre>'
  );

  return convertParsedChildren(
    parseFragment(bodySource as never, roundTripped, parseOptions) as unknown as ParsedNode
  );
};

let removeLayoutWhitespace = (element: HtmlElement) => {
  for (let child of element.childNodes.reverse()) {
    if (child instanceof HtmlText && /^(\n\s\s|\n)$/.test(child.data))
      element.removeChild(child);
    else if (child instanceof HtmlElement) removeLayoutWhitespace(child);
  }

  return element;
};

export let reparseHtmlBody = (body: HtmlElement) => {
  let html = serialize(body as never, { treeAdapter: serializeTreeAdapter as never });
  let document = parse(`<body>${html}</body>`, parseOptions) as unknown as ParsedNode;
  let bodySource = findBody(document);

  return removeLayoutWhitespace(
    bodySource ? convertParsedChildren(bodySource) : new HtmlElement('body')
  );
};
