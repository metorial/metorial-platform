/// <reference path="./worker.d.ts" />

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import {
  conf as javascriptConfiguration,
  language as javascriptLanguage
} from 'monaco-editor/esm/vs/basic-languages/javascript/javascript.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import {
  conf as typescriptConfiguration,
  language as typescriptLanguage
} from 'monaco-editor/esm/vs/basic-languages/typescript/typescript.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/language/css/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/html/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/parameterHints/browser/parameterHints.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let themeName = 'metorial-light';
let isConfigured = false;
let unresolvedSymbolDiagnosticCodes = [2304, 2307, 2503, 2580, 2591, 2688, 2867, 2868, 7016];

// This intentionally remains a compact, static set of declarations. It enables
// useful browser and Node completions without syncing customer files or loading
// project dependencies into the editor worker.
let commonJavascriptGlobals = `
interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
}

interface Location {
  href: string;
  origin: string;
  pathname: string;
  assign(url: string): void;
  replace(url: string): void;
  reload(): void;
}

interface Document {
  querySelector<E extends Element = Element>(selectors: string): E | null;
  querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
  getElementById(elementId: string): HTMLElement | null;
  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K];
}

interface Window {
  readonly document: Document;
  readonly location: Location;
  alert(message?: unknown): void;
  confirm(message?: string): boolean;
  setTimeout(handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]): number;
  clearTimeout(id?: number): void;
  fetch(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<Response>;
}

interface Response {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

interface NodeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  platform: string;
  version: string;
  cwd(): string;
  exit(code?: number): never;
}

declare const window: Window & typeof globalThis;
declare const document: Document;
declare const console: Console;
declare const process: NodeProcess;
declare const Buffer: {
  from(input: string | ArrayBuffer | ArrayLike<number>, encoding?: string): Uint8Array;
  isBuffer(value: unknown): boolean;
};
`;

let declarationKeywords = [
  'abstract',
  'class',
  'const',
  'declare',
  'enum',
  'export',
  'extends',
  'from',
  'function',
  'get',
  'implements',
  'import',
  'interface',
  'let',
  'module',
  'namespace',
  'new',
  'override',
  'private',
  'protected',
  'public',
  'readonly',
  'set',
  'static',
  'type',
  'var'
];
let controlKeywords = [
  'async',
  'await',
  'break',
  'case',
  'catch',
  'continue',
  'default',
  'do',
  'else',
  'finally',
  'for',
  'if',
  'return',
  'switch',
  'throw',
  'try',
  'while',
  'yield'
];
let typeKeywords = [
  'any',
  'bigint',
  'boolean',
  'infer',
  'is',
  'keyof',
  'never',
  'number',
  'object',
  'out',
  'satisfies',
  'string',
  'symbol',
  'typeof',
  'unique',
  'unknown',
  'void'
];
let constantKeywords = ['false', 'null', 'super', 'this', 'true', 'undefined'];

let localCompletionItems: Record<string, Array<{ label: string; insertText: string }>> = {
  python: [
    { label: 'def', insertText: 'def ${1:name}(${2:args}):\n    ${0:pass}' },
    { label: 'class', insertText: 'class ${1:Name}:\n    ${0:pass}' },
    { label: 'if', insertText: 'if ${1:condition}:\n    ${0:pass}' },
    { label: 'for', insertText: 'for ${1:item} in ${2:items}:\n    ${0:pass}' },
    {
      label: 'try',
      insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:error}:\n    ${0:pass}'
    },
    { label: 'with', insertText: 'with ${1:expression} as ${2:value}:\n    ${0:pass}' },
    { label: 'print', insertText: 'print(${0:value})' },
    { label: 'range', insertText: 'range(${0:stop})' },
    { label: 'len', insertText: 'len(${0:value})' },
    { label: 'async', insertText: 'async def ${1:name}(${2:args}):\n    ${0:pass}' }
  ],
  sql: [
    { label: 'SELECT', insertText: 'SELECT ${1:columns}\nFROM ${2:table};' },
    {
      label: 'INSERT',
      insertText: 'INSERT INTO ${1:table} (${2:columns})\nVALUES (${0:values});'
    },
    { label: 'UPDATE', insertText: 'UPDATE ${1:table}\nSET ${2:column} = ${0:value};' },
    { label: 'DELETE', insertText: 'DELETE FROM ${1:table}\nWHERE ${0:condition};' },
    {
      label: 'CREATE TABLE',
      insertText: 'CREATE TABLE ${1:name} (\n  ${0:column} ${2:TEXT}\n);'
    },
    { label: 'JOIN', insertText: 'JOIN ${1:table} ON ${0:condition}' },
    { label: 'WHERE', insertText: 'WHERE ${0:condition}' },
    { label: 'ORDER BY', insertText: 'ORDER BY ${0:column}' }
  ],
  shell: [
    { label: 'if', insertText: 'if ${1:condition}; then\n  ${0::}\nfi' },
    { label: 'for', insertText: 'for ${1:item} in ${2:items}; do\n  ${0::}\ndone' },
    { label: 'function', insertText: '${1:name}() {\n  ${0::}\n}' },
    { label: 'echo', insertText: 'echo "${0:value}"' },
    { label: 'printf', insertText: 'printf \'%s\\n\' "${0:value}"' },
    { label: 'export', insertText: 'export ${1:NAME}=${0:value}' },
    { label: 'grep', insertText: 'grep "${1:pattern}" ${0:file}' },
    { label: 'curl', insertText: 'curl ${0:https://example.com}' }
  ],
  yaml: [
    { label: 'key', insertText: '${1:key}: ${0:value}' },
    { label: 'list', insertText: '${1:key}:\n  - ${0:item}' },
    { label: 'true', insertText: 'true' },
    { label: 'false', insertText: 'false' },
    { label: 'null', insertText: 'null' }
  ],
  markdown: [
    { label: 'heading', insertText: '## ${0:Heading}' },
    { label: 'link', insertText: '[${1:text}](${0:url})' },
    { label: 'image', insertText: '![${1:alt text}](${0:url})' },
    { label: 'code block', insertText: '``` ${1:language}\n${0}\n```' },
    { label: 'task', insertText: '- [ ] ${0:Task}' }
  ],
  xml: [
    { label: 'element', insertText: '<${1:element}>${0}</${1:element}>' },
    { label: 'comment', insertText: '<!-- ${0:comment} -->' },
    { label: 'CDATA', insertText: '<![CDATA[${0}]]>' }
  ],
  rust: [
    { label: 'fn', insertText: 'fn ${1:name}(${2:args}) {\n    ${0}\n}' },
    { label: 'struct', insertText: 'struct ${1:Name} {\n    ${0}\n}' },
    { label: 'impl', insertText: 'impl ${1:Type} {\n    ${0}\n}' },
    { label: 'match', insertText: 'match ${1:value} {\n    ${0:_ => {}}\n}' },
    { label: 'println', insertText: 'println!("${0}");' }
  ]
};

let createRichJavascriptLanguage = (base: any) => ({
  ...base,
  declarationKeywords,
  controlKeywords,
  typeKeywords,
  constantKeywords,
  tokenizer: {
    ...base.tokenizer,
    common: [
      [
        /(function)([ \t]+)([A-Za-z_$][\w$]*)/,
        ['keyword.declaration', '', 'function.declaration']
      ],
      [
        /(class|interface|type|enum|namespace)([ \t]+)([A-Za-z_$][\w$]*)/,
        ['keyword.declaration', '', 'type.identifier']
      ],
      [
        /(const|let|var)([ \t]+)([A-Za-z_$][\w$]*)/,
        ['keyword.declaration', '', 'variable.declaration']
      ],
      [/(\.)([A-Z][\w$]*)/, ['delimiter', 'constant']],
      [/(\.)([a-z_$][\w$]*)(?=[ \t]*\()/, ['delimiter', 'function.method']],
      [/(\.)([a-z_$][\w$]*)/, ['delimiter', 'property']],
      [/[A-Za-z_$][\w$]*(?=[ \t]*:)/, 'property'],
      [
        /#?[a-z_$][\w$]*(?=[ \t]*\()/,
        {
          cases: {
            '@controlKeywords': 'keyword.control',
            '@declarationKeywords': 'keyword.declaration',
            '@typeKeywords': 'keyword.type',
            '@constantKeywords': 'constant.language',
            '@keywords': 'keyword',
            '@default': 'function'
          }
        }
      ],
      [
        /#?[a-z_$][\w$]*/,
        {
          cases: {
            '@controlKeywords': 'keyword.control',
            '@declarationKeywords': 'keyword.declaration',
            '@typeKeywords': 'keyword.type',
            '@constantKeywords': 'constant.language',
            '@keywords': 'keyword',
            '@default': 'variable'
          }
        }
      ],
      ...base.tokenizer.common.slice(1)
    ]
  }
});

let registerLocalCompletionProvider = (
  language: string,
  items: Array<{ label: string; insertText: string }>
) => {
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['.', ':', ' '],
    provideCompletionItems: (model, position) => {
      let word = model.getWordUntilPosition(position);
      let range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      );

      return {
        suggestions: items.map((item, index) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: `${index}`
        }))
      };
    }
  });
};

let getOpaqueModelUri = (language: string, fileName?: string) => {
  let extension =
    fileName
      ?.split('.')
      .pop()
      ?.replace(/[^a-z0-9]/gi, '') || language;
  let scope = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return monaco.Uri.parse(`inmemory://skill-editor/${scope}/file.${extension}`);
};

let configureMonaco = () => {
  if (isConfigured) return;
  isConfigured = true;

  (globalThis as any).MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label == 'json') return new JsonWorker();
      if (label == 'css' || label == 'scss' || label == 'less') return new CssWorker();
      if (label == 'html' || label == 'handlebars' || label == 'razor')
        return new HtmlWorker();
      if (label == 'typescript' || label == 'javascript') return new TypeScriptWorker();
      return new EditorWorker();
    }
  };

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    allowJs: true,
    allowNonTsExtensions: true,
    checkJs: true,
    noResolve: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ES2020
  });
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    noResolve: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ES2020
  });
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: unresolvedSymbolDiagnosticCodes
  });
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(false);
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: unresolvedSymbolDiagnosticCodes
  });
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(false);
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    commonJavascriptGlobals,
    'inmemory://metorial-editor/common-globals.d.ts'
  );
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    commonJavascriptGlobals,
    'inmemory://metorial-editor/common-globals.d.ts'
  );

  monaco.languages.register({
    id: 'javascript',
    extensions: ['.js', '.es6', '.jsx', '.mjs', '.cjs'],
    firstLine: '^#!.*\\bnode',
    filenames: ['jakefile'],
    aliases: ['JavaScript', 'javascript', 'js'],
    mimetypes: ['text/javascript']
  });
  monaco.languages.setLanguageConfiguration('javascript', javascriptConfiguration);
  monaco.languages.setMonarchTokensProvider(
    'javascript',
    createRichJavascriptLanguage(javascriptLanguage)
  );

  monaco.languages.register({
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.cts', '.mts'],
    aliases: ['TypeScript', 'ts', 'typescript'],
    mimetypes: ['text/typescript']
  });
  monaco.languages.setLanguageConfiguration('typescript', typescriptConfiguration);
  monaco.languages.setMonarchTokensProvider(
    'typescript',
    createRichJavascriptLanguage(typescriptLanguage)
  );

  monaco.languages.register({
    id: 'json',
    extensions: ['.json'],
    aliases: ['JSON', 'json'],
    mimetypes: ['application/json']
  });
  monaco.languages.setMonarchTokensProvider('json', {
    tokenizer: {
      root: [
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'key'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
        [/\b(?:true|false|null)\b/, 'keyword'],
        [/[{}\[\],:]/, 'delimiter'],
        [/\s+/, 'white']
      ]
    }
  });

  for (let [language, items] of Object.entries(localCompletionItems)) {
    registerLocalCompletionProvider(language, items);
  }

  monaco.editor.defineTheme(themeName, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '71808B', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: '4F8872', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7C3ED1' },
      { token: 'keyword.declaration', foreground: '7C3ED1' },
      { token: 'keyword.control', foreground: 'C13C75' },
      { token: 'keyword.type', foreground: '008C87' },
      { token: 'keyword.operator', foreground: '2D6EB5' },
      { token: 'number', foreground: 'D3620B' },
      { token: 'number.hex', foreground: 'D3620B' },
      { token: 'string', foreground: '008A62' },
      { token: 'string.escape', foreground: 'C65710', fontStyle: 'bold' },
      { token: 'regexp', foreground: 'D13F72' },
      { token: 'type', foreground: '008C87' },
      { token: 'type.identifier', foreground: '008C87' },
      { token: 'function', foreground: '006FD6' },
      { token: 'function.declaration', foreground: '006FD6' },
      { token: 'function.method', foreground: '0095A8' },
      { token: 'variable', foreground: '365D78' },
      { token: 'variable.declaration', foreground: 'B85B12' },
      { token: 'variable.predefined', foreground: 'A43DA8' },
      { token: 'constant', foreground: 'D05B21' },
      { token: 'constant.language', foreground: 'D05B21' },
      { token: 'property', foreground: '007CBA' },
      { token: 'key', foreground: '007CBA' },
      { token: 'tag', foreground: '8052D0' },
      { token: 'attribute.name', foreground: '008C87' },
      { token: 'attribute.value', foreground: '008A62' },
      { token: 'annotation', foreground: 'D05B21' },
      { token: 'operator', foreground: '2D6EB5' },
      { token: 'delimiter', foreground: '747E89' },
      { token: 'delimiter.bracket', foreground: '3478C7' },
      { token: 'identifier', foreground: '365D78' },
      { token: 'invalid', foreground: 'C13E46', fontStyle: 'underline' }
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#39434B',
      'editorCursor.foreground': '#006FD6',
      'editor.selectionBackground': '#CADFFF',
      'editor.inactiveSelectionBackground': '#E2ECFA',
      'editor.selectionHighlightBackground': '#DDEBFA80',
      'editor.wordHighlightBackground': '#DCEAE580',
      'editor.wordHighlightStrongBackground': '#D7E3F580',
      'editor.lineHighlightBackground': '#F6F8FA',
      'editorLineNumber.foreground': '#929BA2',
      'editorLineNumber.activeForeground': '#3478C7',
      'editorGutter.background': '#FFFFFF',
      'editorIndentGuide.background1': '#E5E5E5',
      'editorIndentGuide.activeBackground1': '#AABAC5',
      'editorWhitespace.foreground': '#D5D5D5',
      'editorBracketHighlight.foreground1': '#3478C7',
      'editorBracketHighlight.foreground2': '#8A4FD1',
      'editorBracketHighlight.foreground3': '#06966B',
      'editorBracketHighlight.foreground4': '#D66B13',
      'editorBracketHighlight.foreground5': '#D34B78',
      'editorBracketHighlight.foreground6': '#009994',
      'editorBracketHighlight.unexpectedBracket.foreground': '#C13E46',
      'editorWidget.background': '#FFFFFF',
      'editorWidget.border': '#DDDDDD',
      'editorSuggestWidget.background': '#FFFFFF',
      'editorSuggestWidget.border': '#DDDDDD',
      'editorSuggestWidget.selectedBackground': '#EEF3FA',
      'editorSuggestWidget.foreground': '#39434B',
      'editorSuggestWidget.selectedForeground': '#263641',
      'editorSuggestWidget.highlightForeground': '#006FD6',
      'list.activeSelectionBackground': '#E4EEF9',
      'list.activeSelectionForeground': '#263641',
      'list.inactiveSelectionBackground': '#EEF3FA',
      'list.inactiveSelectionForeground': '#39434B',
      'list.focusAndSelectionOutline': '#B6D0EC',
      'scrollbar.shadow': '#00000012',
      'scrollbarSlider.background': '#0000001F',
      'scrollbarSlider.hoverBackground': '#00000033',
      'scrollbarSlider.activeBackground': '#00000042'
    }
  });
};

export type MonacoCodeEditorHandle = {
  focus: () => void;
  insert: (text: string) => void;
  isFocused: () => boolean;
};

export type MonacoCodeEditorProps = {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  ariaLabel?: string;
  fileName?: string;
};

export let MonacoCodeEditor = forwardRef<MonacoCodeEditorHandle, MonacoCodeEditorProps>(
  (
    { value, language = 'plaintext', onChange, onBlur, readOnly, ariaLabel, fileName },
    outerRef
  ) => {
    let containerRef = useRef<HTMLDivElement | null>(null);
    let editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    let modelRef = useRef<monaco.editor.ITextModel | null>(null);
    let onChangeRef = useRef(onChange);
    let onBlurRef = useRef(onBlur);
    onChangeRef.current = onChange;
    onBlurRef.current = onBlur;

    useImperativeHandle(
      outerRef,
      () => ({
        focus: () => editorRef.current?.focus(),
        insert: text => {
          let editor = editorRef.current;
          let selection = editor?.getSelection();
          if (!editor || !selection) return;
          editor.executeEdits('metorial', [
            { range: selection, text, forceMoveMarkers: true }
          ]);
        },
        isFocused: () => editorRef.current?.hasTextFocus() ?? false
      }),
      []
    );

    useEffect(() => {
      let container = containerRef.current;
      if (!container) return;

      configureMonaco();
      let model = monaco.editor.createModel(
        value,
        language,
        getOpaqueModelUri(language, fileName)
      );
      let editor = monaco.editor.create(container, {
        model,
        theme: themeName,
        readOnly: !!readOnly,
        ariaLabel: ariaLabel ?? 'Code editor',
        automaticLayout: false,
        fontFamily:
          "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        fontSize: 13,
        lineHeight: 21,
        lineNumbers: 'on',
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: false,
        minimap: { enabled: false },
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        tabCompletion: 'on',
        parameterHints: { enabled: true },
        hover: { enabled: true },
        wordBasedSuggestions: 'currentDocument',
        renderLineHighlight: 'line',
        renderWhitespace: 'selection',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        wordWrap: 'off',
        padding: { top: 14, bottom: 14 },
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          horizontalScrollbarSize: 10,
          verticalScrollbarSize: 10
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        stickyScroll: { enabled: false },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: false, indentation: true }
      });
      let resizeObserver = new ResizeObserver(() => editor.layout());
      resizeObserver.observe(container);
      let contentSubscription = editor.onDidChangeModelContent(() => {
        onChangeRef.current?.(model.getValue());
      });
      let blurSubscription = editor.onDidBlurEditorText(() => onBlurRef.current?.());

      editorRef.current = editor;
      modelRef.current = model;
      editor.layout();

      return () => {
        resizeObserver.disconnect();
        contentSubscription.dispose();
        blurSubscription.dispose();
        editor.dispose();
        model.dispose();
        editorRef.current = null;
        modelRef.current = null;
      };
    }, []);

    useEffect(() => {
      let model = modelRef.current;
      if (!model || model.getValue() == value) return;

      model.setValue(value);
    }, [value]);

    useEffect(() => {
      let model = modelRef.current;
      if (model && model.getLanguageId() != language) {
        monaco.editor.setModelLanguage(model, language);
      }
    }, [language]);

    useEffect(() => {
      editorRef.current?.updateOptions({ readOnly: !!readOnly });
    }, [readOnly]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
      />
    );
  }
);
