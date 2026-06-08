import { Tooltip } from '@metorial/ui';
import { useMemo } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import { Popover, usePopoverAnchor } from '../components/Popover';
import type { SharedPerson } from './HeaderActions';
import { IconChevronDown, IconCode, IconHistory, IconText } from './icons';

interface CurrentUserStatus {
  name: string;
  email: string;
  imageUrl?: string;
  role: 'editor' | 'viewer';
}

interface TitleStatusBarProps {
  currentUser: CurrentUserStatus;
  editors: SharedPerson[];
  updatedAt: Date;
  wordCount: number;
  charCount: number;
  frontMatterOpen?: boolean;
  hasFrontMatter?: boolean;
  frontMatterError?: string | null;
  onToggleFrontMatter?: () => void;
  onOpenPageInfo?: () => void;
}

let TRIGGER_SELECTOR = '[data-title-status-editors-trigger]';

let Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 0px 0px 0px -8px;
  padding-bottom: 25px;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: 13px;
  min-height: 24px;
`;

let StatusItemBtn = styled.button<{ $clickable?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 8px;
  border: 0;
  font: inherit;
  font-size: 13px;
  color: inherit;
  background: transparent;
  border-radius: 8px;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }
`;

let EditorsTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 8px;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }
`;

let Text = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let FrontMatterBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.color.text : theme.color.textMuted)};
  font: inherit;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transform: rotate(${({ $active }) => ($active ? '180deg' : '0deg')});
    transition: transform ${({ theme }) => theme.motion.fast};
  }
`;

let IconWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.color.textSubtle};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let PopoverList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 6px 0;
`;

let PopoverTitle = styled.div`
  padding: 6px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.textSubtle};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

let EditorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
`;

let EditorInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;

  .name {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.color.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .email {
    font-size: 11.5px;
    color: ${({ theme }) => theme.color.textSubtle};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

function formatUpdatedAt(date: Date): string {
  let time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  let day = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return `Updated at ${time} ${day}`;
}

function getMostRecentlyEdited(editors: SharedPerson[]): SharedPerson | null {
  let winner: SharedPerson | null = null;
  let winnerTs = -Infinity;
  for (let person of editors) {
    if (!person.lastEditedAt) continue;
    let ts = new Date(person.lastEditedAt).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts > winnerTs) {
      winner = person;
      winnerTs = ts;
    }
  }
  return winner ?? editors[0] ?? null;
}

export function TitleStatusBar({
  currentUser,
  editors,
  updatedAt,
  wordCount,
  charCount,
  frontMatterOpen = false,
  hasFrontMatter = false,
  frontMatterError = null,
  onToggleFrontMatter,
  onOpenPageInfo
}: TitleStatusBarProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = usePopoverAnchor('left');
  let tokenCount = Math.max(0, Math.round(charCount / 4));

  let shownPerson = useMemo(() => {
    if (currentUser.role === 'editor') {
      return {
        name: currentUser.name,
        email: currentUser.email,
        imageUrl: currentUser.imageUrl
      };
    }
    let last = getMostRecentlyEdited(editors);
    if (last) {
      return { name: last.name, email: last.email, imageUrl: last.imageUrl };
    }
    return {
      name: currentUser.name,
      email: currentUser.email,
      imageUrl: currentUser.imageUrl
    };
  }, [currentUser, editors]);

  let tooltip = `~${tokenCount.toLocaleString()} Tokens · ${wordCount.toLocaleString()} words · ${charCount.toLocaleString()} characters`;

  return (
    <>
      <Bar>
        <EditorsTrigger
          ref={triggerRef}
          type="button"
          data-title-status-editors-trigger="true"
          onClick={toggle}
          title="Show editors"
        >
          <Avatar
            name={shownPerson.name}
            imageUrl={shownPerson.imageUrl}
            email={shownPerson.email}
            size={20}
            noTooltip
          />
          <span className="name">{shownPerson.name}</span>
        </EditorsTrigger>

        <StatusItemBtn
          type="button"
          $clickable={!!onOpenPageInfo}
          onClick={() => onOpenPageInfo?.()}
          title="Open page info"
        >
          <IconWrap>
            <IconHistory />
          </IconWrap>
          <Text>{formatUpdatedAt(updatedAt)}</Text>
        </StatusItemBtn>

        <Tooltip content={tooltip} side="bottom">
          <StatusItemBtn
            type="button"
            $clickable={!!onOpenPageInfo}
            onClick={() => onOpenPageInfo?.()}
            title="Open page info"
          >
            <IconWrap>
              <IconText />
            </IconWrap>
            <Text>~{tokenCount.toLocaleString()} Tokens</Text>
          </StatusItemBtn>
        </Tooltip>

        <FrontMatterBtn
          type="button"
          $active={frontMatterOpen}
          onClick={() => onToggleFrontMatter?.()}
          title={
            frontMatterError
              ? `Invalid front matter: ${frontMatterError}`
              : frontMatterOpen
                ? 'Collapse front matter'
                : 'Expand front matter'
          }
        >
          <IconWrap>
            <IconCode />
          </IconWrap>
          <Text>{hasFrontMatter ? 'Front matter' : 'Add front matter'}</Text>
          <span className="chevron">
            <IconChevronDown />
          </span>
        </FrontMatterBtn>
      </Bar>

      <Popover
        open={open}
        anchor={anchor}
        width={300}
        ignoreClickOnSelector={TRIGGER_SELECTOR}
        onClose={closeMenu}
      >
        <PopoverList>
          <PopoverTitle>Editors</PopoverTitle>
          {editors.map(editor => (
            <EditorRow key={editor.email}>
              <Avatar
                name={editor.name}
                imageUrl={editor.imageUrl}
                email={editor.email}
                size={26}
                noTooltip
              />
              <EditorInfo>
                <span className="name">{editor.name}</span>
                <span className="email">{editor.email}</span>
              </EditorInfo>
            </EditorRow>
          ))}
        </PopoverList>
      </Popover>
    </>
  );
}
