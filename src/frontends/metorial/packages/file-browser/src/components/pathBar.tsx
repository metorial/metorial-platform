import { theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import { useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { getPathSegments, isSameOrDescendant, normalizePath } from '../lib/path';

let Bar = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 30px;
  border-radius: 8px;
  background: ${theme.colors.gray300};
  outline: 1px solid transparent;
  transition: all 0.3s ease;

  &:focus-within {
    background: ${theme.colors.gray400};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

let Scroller = styled.nav`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

let Segments = styled.ol`
  display: flex;
  align-items: center;
  flex: none;
  gap: 1px;
  margin: 0;
  padding: 0 0 0 4px;
  list-style: none;
`;

let SegmentItem = styled.li`
  display: flex;
  align-items: center;
  gap: 1px;
`;

let Segment = styled.button`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 6px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: ${theme.colors.gray800};
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${theme.colors.gray450};
    outline: none;
  }

  &[aria-current='page'] {
    color: ${theme.colors.foreground};
    font-weight: 600;
  }

  &:disabled {
    cursor: default;
  }
`;

let Separator = styled(RiArrowRightSLine)`
  flex: none;
  color: ${theme.colors.gray600};
`;

let EditArea = styled.button`
  flex: 1;
  align-self: stretch;
  min-width: 24px;
  border: none;
  background: transparent;
  cursor: text;

  &:focus-visible {
    outline: none;
  }
`;

let PathInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: ${theme.colors.foreground};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  outline: none;
`;

export let PathBar = (p: {
  path: string;
  rootPath: string;
  disabled?: boolean;
  onNavigate: (path: string) => void;
}) => {
  let [editing, setEditing] = useState(false);
  let [draft, setDraft] = useState(p.path);
  let scrollerRef = useRef<HTMLElement | null>(null);

  let segments = getPathSegments(p.path).filter(segment =>
    isSameOrDescendant(segment.path, p.rootPath)
  );

  useLayoutEffect(() => {
    let scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [p.path, editing]);

  let startEditing = () => {
    if (p.disabled) return;

    setDraft(p.path);
    setEditing(true);
  };

  let submit = () => {
    setEditing(false);

    let next = normalizePath(draft.trim() || p.rootPath);
    if (next != p.path) p.onNavigate(next);
  };

  if (editing) {
    return (
      <Bar>
        <PathInput
          aria-label="Path"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          value={draft}
          onFocus={e => e.currentTarget.select()}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={e => {
            if (e.key == 'Enter') {
              e.preventDefault();
              submit();
            }

            if (e.key == 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
        />
      </Bar>
    );
  }

  return (
    <Bar>
      <Scroller aria-label="Path" ref={scrollerRef}>
        <Segments>
          {segments.map((segment, i) => {
            let isLast = i == segments.length - 1;

            return (
              <SegmentItem key={segment.path}>
                {i > 0 ? <Separator size={14} aria-hidden /> : null}
                <Segment
                  type="button"
                  aria-current={isLast ? 'page' : undefined}
                  disabled={p.disabled}
                  onClick={() => (isLast ? startEditing() : p.onNavigate(segment.path))}
                >
                  {segment.name}
                </Segment>
              </SegmentItem>
            );
          })}
        </Segments>

        <EditArea
          type="button"
          aria-label="Edit Path"
          disabled={p.disabled}
          onClick={startEditing}
        />
      </Scroller>
    </Bar>
  );
};
