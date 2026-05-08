import { CodeBlock } from '@metorial/code';
import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';

export let ToolSurfaceCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  background: ${theme.colors.gray100};
  padding: 12px 14px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 10px 24px rgba(15, 23, 42, 0.03);
`;

export let NestedToolSurfaceCard = styled(ToolSurfaceCard)`
  background: color-mix(in srgb, ${theme.colors.foreground} 2%, ${theme.colors.background});
  box-shadow: none;
`;

export let ToolHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

export let ToolHeaderMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

export let ToolTitle = styled(Text).attrs({
  size: '2'
})`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, ${theme.colors.foreground} 22%, transparent);
    flex: 0 0 auto;
  }
`;

export let ToolDetail = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
`;

export let ToolStatusBadge = styled.span<{ $status?: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${p =>
    p.$status == 'failed'
      ? `color-mix(in srgb, ${theme.colors.red800} 12%, transparent)`
      : p.$status == 'running'
        ? `color-mix(in srgb, ${theme.colors.orange800} 12%, transparent)`
        : `color-mix(in srgb, ${theme.colors.foreground} 6%, transparent)`};
  color: ${p =>
    p.$status == 'failed'
      ? theme.colors.red800
      : p.$status == 'running'
        ? theme.colors.orange800
        : `color-mix(in srgb, ${theme.colors.foreground} 62%, transparent)`};
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-transform: capitalize;
  white-space: nowrap;
`;

export let ToolContentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let ToolSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export let ToolSectionLabel = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
  font-weight: 600;
  letter-spacing: 0.01em;
`;

export let ToolPathTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, ${theme.colors.foreground} 3%, transparent);
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  font-size: 12px;
  color: color-mix(in srgb, ${theme.colors.foreground} 70%, transparent);
  word-break: break-word;
`;

export let ToolMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export let ToolMetaChip = styled.span<{
  $tone?: 'default' | 'added' | 'removed' | 'warning' | 'danger';
}>`
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid
    ${p =>
      p.$tone == 'added'
        ? `color-mix(in srgb, ${theme.colors.green800} 20%, transparent)`
        : p.$tone == 'removed' || p.$tone == 'danger'
          ? `color-mix(in srgb, ${theme.colors.red800} 20%, transparent)`
          : p.$tone == 'warning'
            ? `color-mix(in srgb, ${theme.colors.orange800} 20%, transparent)`
            : `color-mix(in srgb, ${theme.colors.foreground} 10%, transparent)`};
  background: ${p =>
    p.$tone == 'added'
      ? `color-mix(in srgb, ${theme.colors.green800} 9%, transparent)`
      : p.$tone == 'removed' || p.$tone == 'danger'
        ? `color-mix(in srgb, ${theme.colors.red800} 9%, transparent)`
        : p.$tone == 'warning'
          ? `color-mix(in srgb, ${theme.colors.orange800} 9%, transparent)`
          : `color-mix(in srgb, ${theme.colors.foreground} 4%, transparent)`};
  color: ${p =>
    p.$tone == 'added'
      ? theme.colors.green800
      : p.$tone == 'removed' || p.$tone == 'danger'
        ? theme.colors.red800
        : p.$tone == 'warning'
          ? theme.colors.orange800
          : `color-mix(in srgb, ${theme.colors.foreground} 70%, transparent)`};
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
`;

export let ScrollSection = styled.div`
  max-height: 420px;
  overflow: auto;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 9%, transparent);
  background: ${theme.colors.background};
`;

export let getStatusLabel = (status?: string) => {
  if (!status) return null;
  return status.replaceAll('_', ' ');
};

export let getDisplayPath = (filePath: string) => {
  if (!filePath) return '';

  let prefixes = ['/project/sandbox/repo/', '/project/sandbox/', '/project/', '/workspace/'];
  for (let prefix of prefixes) {
    if (filePath.startsWith(prefix)) return filePath.slice(prefix.length);
  }

  let worktreeMatch = filePath.match(/\.21st\/worktrees\/[^/]+\/[^/]+\/(.+)$/);
  if (worktreeMatch?.[1]) return worktreeMatch[1];

  if (filePath.startsWith('/')) {
    let parts = filePath.split('/');
    let rootIndicators = ['apps', 'packages', 'src', 'lib', 'components', 'oss', 'federation'];
    let rootIndex = parts.findIndex(part => rootIndicators.includes(part));
    if (rootIndex > 0) return parts.slice(rootIndex).join('/');
  }

  return filePath;
};

export let normalizeCommandForDisplay = (command: string) => {
  if (!command) return '';

  let normalized = command.replace(/\\\s*\n\s*/g, ' ').trim();
  return normalized.replace(/\/(?:Users|home|root)\/[^\s"']+/g, match => getDisplayPath(match));
};

export let extractCommandSummary = (command: string) => {
  return normalizeCommandForDisplay(command)
    .split('|')
    .map(segment => segment.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
};

export let unwrapMcpOutput = (value: unknown): unknown => {
  if (!value) return value;

  if (Array.isArray(value)) {
    let textParts = value
      .map(block =>
        typeof block == 'object' &&
        block &&
        'type' in block &&
        (block as { type?: unknown }).type == 'text' &&
        'text' in block
          ? (block as { text?: unknown }).text
          : undefined
      )
      .filter((part): part is string => typeof part == 'string');

    if (textParts.length) {
      let combined = textParts.join('');
      try {
        return JSON.parse(combined);
      } catch {
        return combined;
      }
    }

    return value;
  }

  if (typeof value == 'object' && value && 'type' in value && 'text' in value) {
    let text = (value as { text?: unknown }).text;
    if (typeof text == 'string') {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }

  if (typeof value == 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

export let formatStructuredValue = (value: unknown) => {
  if (value === undefined) return '';
  if (typeof value == 'string') return value;
  return JSON.stringify(value, null, 2);
};

export let JsonBlock = (p: {
  value: unknown;
  language?: string;
  lineNumbers?: boolean;
}) => {
  if (p.value === undefined) return null;

  return (
    <CodeBlock
      lineNumbers={p.lineNumbers ?? true}
      language={p.language ?? 'json'}
      variant="bordered"
      code={formatStructuredValue(p.value)}
    />
  );
};

export let getCodeLanguage = (path?: string) => {
  if (!path) return 'text';
  let normalized = path.toLowerCase();

  if (normalized.endsWith('.tsx')) return 'tsx';
  if (normalized.endsWith('.ts')) return 'typescript';
  if (normalized.endsWith('.jsx')) return 'jsx';
  if (normalized.endsWith('.js') || normalized.endsWith('.mjs') || normalized.endsWith('.cjs'))
    return 'javascript';
  if (normalized.endsWith('.json')) return 'json';
  if (normalized.endsWith('.md') || normalized.endsWith('.mdx')) return 'markdown';
  if (normalized.endsWith('.sh')) return 'bash';
  if (normalized.endsWith('.yml') || normalized.endsWith('.yaml')) return 'yaml';
  if (normalized.endsWith('.html')) return 'html';
  if (normalized.endsWith('.css')) return 'css';
  if (normalized.endsWith('.sql')) return 'sql';
  if (normalized.endsWith('.py')) return 'python';

  return 'text';
};
