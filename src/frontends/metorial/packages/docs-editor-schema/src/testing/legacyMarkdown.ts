import { Editor, getSchema } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import { buildHeadlessExtensions } from '../index';
import { renderMarkdownHtml } from '../markdownParser';

let globalKeys = ['window', 'document', 'DOMParser', 'Node', 'navigator'] as const;

let legacyWindow: JSDOM['window'] | undefined;

export let legacyMarkdownToJSON = (markdown: string) => {
  legacyWindow ??= new JSDOM('<!doctype html><html><body></body></html>').window;

  let previous = globalKeys.map(
    key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const
  );

  for (let key of globalKeys) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: key == 'window' ? legacyWindow : (legacyWindow as any)[key]
    });
  }

  try {
    let editor = new Editor({
      extensions: buildHeadlessExtensions(),
      content: markdown,
      editable: false
    });

    try {
      return editor.state.doc.toJSON();
    } finally {
      editor.destroy();
    }
  } finally {
    for (let [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
};

export let headlessSchema = () => getSchema(buildHeadlessExtensions());

let withLegacyWindow = <T>(run: (window: JSDOM['window']) => T) => {
  legacyWindow ??= new JSDOM('<!doctype html><html><body></body></html>').window;
  return run(legacyWindow);
};

// jsdom's parser adapter appends foster-parented text at the end of its parent instead of
// before the table, so it deviates from the HTML spec for text directly inside a <table>.
// Documents where the two parsers disagree cannot be compared against jsdom.
export let jsdomParsesLikeSpec = async (markdown: string) => {
  let { parse, serialize } = await import('parse5');
  let html = `<body>${renderMarkdownHtml(markdown)}</body>`;

  let jsdomBody = withLegacyWindow(
    window => new window.DOMParser().parseFromString(html, 'text/html').body.innerHTML
  );
  let document: any = parse(html, { scriptingEnabled: false });
  let body = document.childNodes
    .find((node: any) => node.tagName == 'html')
    .childNodes.find((node: any) => node.tagName == 'body');

  return serialize(body) == jsdomBody;
};
