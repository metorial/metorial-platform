declare module 'monaco-editor/editor/editor.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/languages/features/css/css.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/languages/features/html/html.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/languages/features/json/json.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/languages/features/typescript/ts.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/languages/definitions/javascript/javascript.js' {
  import type { languages } from 'monaco-editor/editor/editor.api.js';

  export let conf: languages.LanguageConfiguration;
  export let language: languages.IMonarchLanguage;
}

declare module 'monaco-editor/languages/definitions/typescript/typescript.js' {
  import type { languages } from 'monaco-editor/editor/editor.api.js';

  export let conf: languages.LanguageConfiguration;
  export let language: languages.IMonarchLanguage;
}
