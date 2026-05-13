import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { menuEnter, menuExit } from '../animations';
import { lowlight } from './lowlight';
import { usePresence } from '../usePresence';

let EXTRA_LANGUAGES = ['plaintext', 'mermaid'];

function buildLanguages(): string[] {
  let list = lowlight.listLanguages();
  let set = new Set<string>([...EXTRA_LANGUAGES, ...list]);
  return Array.from(set).sort((a, b) => {
    if (a === 'plaintext') return -1;
    if (b === 'plaintext') return 1;
    if (a === 'mermaid') return -1;
    if (b === 'mermaid') return 1;
    return a.localeCompare(b);
  });
}

let LANGUAGES = buildLanguages();

let PopoverWrap = styled.div`
  position: fixed;
  z-index: 1000;
  width: 240px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.color.bg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.color.shadow};
  overflow: hidden;
  font-family: ${({ theme }) => theme.font.sans};
  transform-origin: top left;

  &[data-state='open'] {
    ${menuEnter(160)}
  }

  &[data-state='closed'] {
    ${menuExit(140)}
    pointer-events: none;
  }
`;

let Search = styled.input`
  padding: 8px 10px;
  margin: 6px;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.color.bgAlt};
  color: ${({ theme }) => theme.color.text};
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.accent};
  }

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
`;

let Item = styled.li`
  padding: 6px 10px;
  border-radius: 5px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.color.text};
  cursor: pointer;
  user-select: none;

  &.is-focused {
    background: ${({ theme }) => theme.color.bgAlt};
  }

  &.is-active {
    color: ${({ theme }) => theme.color.accent};
    font-weight: 600;
  }
`;

let Empty = styled.li`
  padding: 10px;
  color: ${({ theme }) => theme.color.textSubtle};
  font-size: 13px;
  text-align: center;
`;

interface Props {
  value: string;
  onChange: (lang: string) => void;
}

export function LanguagePicker({ value, onChange }: Props) {
  let buttonRef = useRef<HTMLButtonElement | null>(null);
  let popoverRef = useRef<HTMLDivElement | null>(null);
  let [open, setOpen] = useState(false);
  let presence = usePresence(open, 140);
  let [search, setSearch] = useState('');
  let [activeIndex, setActiveIndex] = useState(0);
  let [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  let filtered = useMemo(() => {
    let q = search.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(l => l.toLowerCase().includes(q));
  }, [search]);

  useEffect(() => {
    if (!open) return;
    let updatePos = () => {
      let btn = buttonRef.current;
      if (!btn) return;
      let rect = btn.getBoundingClientRect();
      setCoords({ left: rect.left, top: rect.bottom + 4 });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let onClick = (e: MouseEvent) => {
      let target = e.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    let onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  let safeActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  let select = (lang: string) => {
    onChange(lang);
    setOpen(false);
    setSearch('');
    setActiveIndex(0);
  };

  let handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(Math.min(filtered.length - 1, safeActiveIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(Math.max(0, safeActiveIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      let lang = filtered[safeActiveIndex];
      if (lang) select(lang);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="code-block-lang-btn"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onMouseDown={e => e.preventDefault()}
        title="Change language"
      >
        <span>{value || 'plaintext'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden>
          <polyline
            points="6 9 12 15 18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </button>
      {presence.shouldRender &&
        coords &&
        createPortal(
          <PopoverWrap
            ref={popoverRef}
            className="code-block-lang-popover"
            data-state={presence.dataState}
            style={{ left: coords.left, top: coords.top }}
            contentEditable={false}
          >
            <Search
              autoFocus
              className="code-block-lang-search"
              placeholder="Search language…"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKey}
            />
            <List className="code-block-lang-list" role="listbox">
              {filtered.length === 0 && (
                <Empty className="code-block-lang-empty">No matches</Empty>
              )}
              {filtered.map((lang, i) => (
                <Item
                  key={lang}
                  className={
                    'code-block-lang-item' +
                    (lang === value ? ' is-active' : '') +
                    (i === safeActiveIndex ? ' is-focused' : '')
                  }
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={e => {
                    e.preventDefault();
                    select(lang);
                  }}
                >
                  {lang}
                </Item>
              ))}
            </List>
          </PopoverWrap>,
          document.body
        )}
    </>
  );
}
