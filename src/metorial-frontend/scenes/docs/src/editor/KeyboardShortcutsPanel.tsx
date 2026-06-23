import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Panel } from '@metorial/ui';

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  /** Human label shown on the row. */
  label: string;
  /** Keyboard combinations to render as <kbd> chips. */
  keys: string[];
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

/**
 * Detect whether the user is on macOS so we can render the platform-
 * appropriate modifier glyphs (`⌘`, `⌥`) instead of `Ctrl` / `Alt`.
 * Runs lazily inside an effect so we don't trip up SSR / build time.
 */
function useIsMac(): boolean {
  let [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
  }, []);
  return isMac;
}

/** Replace generic modifier names with mac glyphs when appropriate. */
function platformizeKey(key: string, isMac: boolean): string {
  if (!isMac) return key;
  return key
    .replace(/\bMod\b/g, '⌘')
    .replace(/\bCtrl\b/g, '⌃')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bShift\b/g, '⇧')
    .replace(/\bEnter\b/g, '↵')
    .replace(/\bBackspace\b/g, '⌫')
    .replace(/\bEsc\b/g, 'Esc');
}

let HeaderTitle = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
`;

let Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 4px 0 12px;
`;

let SectionWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let SectionTitle = styled.h3`
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }
`;

let RowLabel = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.color.text};
`;

let KeyGroup = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

let Key = styled.kbd`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.text};
  background: ${({ theme }) => theme.color.bgElevated};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-bottom-width: 2px;
  border-radius: 5px;
  white-space: nowrap;
`;

let Plus = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let SECTIONS: Section[] = [
  {
    title: 'Essentials',
    shortcuts: [
      { label: 'Open command menu', keys: ['/'] },
      { label: 'Undo', keys: ['Mod+Z'] },
      { label: 'Redo', keys: ['Mod+Shift+Z'] },
      { label: 'Insert link', keys: ['Mod+Shift+K'] },
      { label: 'Hard line break', keys: ['Shift+Enter'] }
    ]
  },
  {
    title: 'Text formatting',
    shortcuts: [
      { label: 'Bold', keys: ['Mod+B'] },
      { label: 'Italic', keys: ['Mod+I'] },
      { label: 'Underline', keys: ['Mod+U'] },
      { label: 'Strikethrough', keys: ['Mod+Shift+S'] },
      { label: 'Inline code', keys: ['Mod+E'] },
      { label: 'Highlight', keys: ['Mod+Shift+H'] }
    ]
  },
  {
    title: 'Headings & blocks',
    shortcuts: [
      { label: 'Heading 1', keys: ['Mod+Alt+1'] },
      { label: 'Heading 2', keys: ['Mod+Alt+2'] },
      { label: 'Heading 3', keys: ['Mod+Alt+3'] },
      { label: 'Paragraph', keys: ['Mod+Alt+0'] },
      { label: 'Blockquote', keys: ['Mod+Shift+B'] },
      { label: 'Callout', keys: ['Mod+Shift+C'] },
      { label: 'Code block', keys: ['Mod+Alt+C'] },
      { label: 'Bullet list', keys: ['Mod+Shift+8'] },
      { label: 'Numbered list', keys: ['Mod+Shift+7'] },
      { label: 'To-do list', keys: ['Mod+Shift+9'] }
    ]
  },
  {
    title: 'Markdown shortcuts',
    shortcuts: [
      { label: 'Heading 1 → 6', keys: ['#', '##', '###'] },
      { label: 'Bullet list', keys: ['-', '*'] },
      { label: 'Numbered list', keys: ['1.'] },
      { label: 'To-do list', keys: ['[ ]'] },
      { label: 'Blockquote', keys: ['>'] },
      { label: 'Code block', keys: ['```'] },
      { label: 'Horizontal rule', keys: ['---'] },
      { label: 'Bold', keys: ['**text**'] },
      { label: 'Italic', keys: ['*text*', '_text_'] },
      { label: 'Inline code', keys: ['`text`'] },
      { label: 'Strikethrough', keys: ['~~text~~'] }
    ]
  }
];

interface KeyChipsProps {
  combo: string;
  isMac: boolean;
}

/**
 * Render a single shortcut combination ("Mod+Shift+B") as a row of <kbd>
 * chips separated by `+` glyphs. Plain markdown triggers like `**text**`
 * are rendered verbatim as a single chip so the user sees exactly what
 * they need to type.
 */
function KeyChips({ combo, isMac }: KeyChipsProps) {
  let looksLikeShortcut = /[A-Za-z0-9]/.test(combo) && combo.includes('+');
  if (!looksLikeShortcut) {
    return <Key>{combo}</Key>;
  }
  let parts = combo.split('+').map(part => platformizeKey(part, isMac));
  return (
    <KeyGroup>
      {parts.map((part, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Key>{part}</Key>
          {i < parts.length - 1 && !isMac && <Plus>+</Plus>}
        </span>
      ))}
    </KeyGroup>
  );
}

interface KeyComboProps {
  shortcut: Shortcut;
  isMac: boolean;
}

function KeyCombo({ shortcut, isMac }: KeyComboProps) {
  return (
    <KeyGroup>
      {shortcut.keys.map((combo, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <Plus>or</Plus>}
          <KeyChips combo={combo} isMac={isMac} />
        </span>
      ))}
    </KeyGroup>
  );
}

export function KeyboardShortcutsPanel({ open, onOpenChange }: KeyboardShortcutsPanelProps) {
  let isMac = useIsMac();
  let sections = useMemo(() => SECTIONS, []);

  return (
    <Panel.Wrapper isOpen={open} onOpenChange={onOpenChange} width={520}>
      <Panel.Header>
        <HeaderTitle>Keyboard &amp; markdown shortcuts</HeaderTitle>
      </Panel.Header>
      <Panel.Content>
        <Body>
          {sections.map(section => (
            <SectionWrap key={section.title}>
              <SectionTitle>{section.title}</SectionTitle>
              {section.shortcuts.map(shortcut => (
                <Row key={shortcut.label}>
                  <RowLabel>{shortcut.label}</RowLabel>
                  <KeyCombo shortcut={shortcut} isMac={isMac} />
                </Row>
              ))}
            </SectionWrap>
          ))}
        </Body>
      </Panel.Content>
    </Panel.Wrapper>
  );
}
