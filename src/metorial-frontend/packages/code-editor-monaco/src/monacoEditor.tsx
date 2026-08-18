/// <reference path="./worker.d.ts" />

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
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
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let themeName = 'metorial-light';
let isConfigured = false;

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

let configureMonaco = () => {
  if (isConfigured) return;
  isConfigured = true;

  (globalThis as any).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    }
  };

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
};

export let MonacoCodeEditor = forwardRef<MonacoCodeEditorHandle, MonacoCodeEditorProps>(
  ({ value, language = 'plaintext', onChange, onBlur, readOnly, ariaLabel }, outerRef) => {
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
      let model = monaco.editor.createModel(value, language);
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
