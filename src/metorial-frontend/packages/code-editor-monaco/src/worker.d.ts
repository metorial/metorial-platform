declare module 'monaco-editor/esm/vs/editor/editor.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/esm/vs/language/css/css.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/esm/vs/language/html/html.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/esm/vs/language/json/json.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker' {
  let WorkerConstructor: { new (): Worker };
  export default WorkerConstructor;
}

declare module 'monaco-editor/esm/vs/basic-languages/javascript/javascript.js' {
  import type { languages } from 'monaco-editor/esm/vs/editor/editor.api.js';

  export let conf: languages.LanguageConfiguration;
  export let language: languages.IMonarchLanguage;
}

declare module 'monaco-editor/esm/vs/basic-languages/typescript/typescript.js' {
  import type { languages } from 'monaco-editor/esm/vs/editor/editor.api.js';

  export let conf: languages.LanguageConfiguration;
  export let language: languages.IMonarchLanguage;
}
