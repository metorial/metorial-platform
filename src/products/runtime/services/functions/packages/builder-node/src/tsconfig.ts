export let bundleTsConfig = {
  filename: 'tsconfig.json',
  content: JSON.stringify(
    {
      compilerOptions: {
        lib: ['ESNext', 'DOM', 'DOM.Iterable'],
        target: 'es2020',
        jsx: 'react-jsx',
        allowJs: true,
        moduleResolution: 'bundler',
        verbatimModuleSyntax: false,
        strict: false,
        skipLibCheck: true,
        noFallthroughCasesInSwitch: false,
        noUncheckedIndexedAccess: false,
        noImplicitOverride: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noPropertyAccessFromIndexSignature: false
      }
    },
    null,
    2
  )
};
