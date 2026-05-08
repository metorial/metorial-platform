import { CodeBlock } from '@metorial/code';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Text, theme } from '@metorial/ui';
import styled from 'styled-components';

export let ToolSurfaceCard = styled.div<{ $status?: 'running' | 'completed' | 'failed' }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 16px;
  border: 1px solid
    ${p =>
      p.$status == 'failed'
        ? `color-mix(in srgb, ${theme.colors.red800} 45%, transparent)`
        : `color-mix(in srgb, ${theme.colors.foreground} 8%, transparent)`};
  background: color-mix(in srgb, ${theme.colors.background} 88%, ${theme.colors.gray100});
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
`;

export let NestedToolSurfaceCard = styled(ToolSurfaceCard)`
  background: color-mix(in srgb, ${theme.colors.background} 94%, ${theme.colors.gray100});
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
  gap: 12px;
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
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 7%, transparent);
  background: color-mix(in srgb, ${theme.colors.background} 96%, ${theme.colors.gray100});
`;

let SummaryButton = styled.button<{ $clickable: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: none;
  border-radius: 16px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  cursor: ${p => (p.$clickable ? 'pointer' : 'default')};

  &:hover {
    background: ${p =>
      p.$clickable
        ? `color-mix(in srgb, ${theme.colors.foreground} 3%, transparent)`
        : 'transparent'};
  }
`;

let SummaryMain = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let SummaryText = styled(Text).attrs({
  size: '2'
})`
  font-weight: 500;
  color: ${theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let SummarySecondary = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let SummaryRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
`;

let SummaryPill = styled.span<{ $status?: string }>`
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: ${p =>
    p.$status == 'failed'
      ? `color-mix(in srgb, ${theme.colors.red800} 10%, transparent)`
      : `color-mix(in srgb, ${theme.colors.orange800} 10%, transparent)`};
  color: ${p => (p.$status == 'failed' ? theme.colors.red800 : theme.colors.orange800)};
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-transform: capitalize;
`;

let Chevron = styled(motion.span)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
`;

let ContentArea = styled(motion.div)`
  overflow: hidden;
`;

let ContentInner = styled.div`
  padding: 0 12px 12px;
`;

export let getStatusLabel = (status?: string) => {
  if (!status) return null;
  return status.replaceAll('_', ' ');
};

let ChevronIcon = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden="true">
    <path
      d="M4 2.5L7.5 6L4 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export let ToolDisclosureCard = (p: {
  summary: string;
  secondaryText?: string | null;
  status?: 'running' | 'completed' | 'failed';
  defaultOpen?: boolean;
  autoCollapseOnComplete?: boolean;
  children?: ReactNode;
}) => {
  let hasContent = !!p.children;
  let [isOpen, setIsOpen] = useState(p.defaultOpen ?? true);

  useEffect(() => {
    if (p.autoCollapseOnComplete && p.status == 'completed') {
      setIsOpen(false);
    }
  }, [p.autoCollapseOnComplete, p.status]);

  let showStatus = p.status == 'running' || p.status == 'failed';

  return (
    <ToolSurfaceCard $status={p.status}>
      <SummaryButton
        type="button"
        $clickable={hasContent}
        onClick={() => {
          if (!hasContent) return;
          setIsOpen(open => !open);
        }}
      >
        <SummaryMain>
          <SummaryText>{p.summary}</SummaryText>
          {p.secondaryText ? <SummarySecondary>{p.secondaryText}</SummarySecondary> : null}
        </SummaryMain>

        <SummaryRight>
          {showStatus ? (
            <SummaryPill $status={p.status}>{getStatusLabel(p.status)}</SummaryPill>
          ) : null}
          {hasContent ? (
            <Chevron animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.16 }}>
              <ChevronIcon />
            </Chevron>
          ) : null}
        </SummaryRight>
      </SummaryButton>

      <AnimatePresence initial={false}>
        {hasContent && isOpen ? (
          <ContentArea
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ContentInner>{p.children}</ContentInner>
          </ContentArea>
        ) : null}
      </AnimatePresence>
    </ToolSurfaceCard>
  );
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
  variant?: 'bordered' | 'seamless';
}) => {
  if (p.value === undefined) return null;

  return (
    <CodeBlock
      lineNumbers={p.lineNumbers ?? false}
      language={p.language ?? 'json'}
      variant={p.variant ?? 'seamless'}
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
