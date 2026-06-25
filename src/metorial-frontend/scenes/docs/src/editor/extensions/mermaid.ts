type MermaidModule = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidModule> | null = null;
let lastTheme: 'light' | 'dark' | null = null;

function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(m => m.default);
  }
  return mermaidPromise;
}

export async function getMermaid(theme: 'light' | 'dark'): Promise<MermaidModule> {
  let mermaid = await loadMermaid();
  if (lastTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'inherit'
    });
    lastTheme = theme;
  }
  return mermaid;
}

let counter = 0;
export function nextMermaidId(prefix = 'mermaid'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}
