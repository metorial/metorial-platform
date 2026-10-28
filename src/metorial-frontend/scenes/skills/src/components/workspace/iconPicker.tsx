import {
  DEFAULT_SKILL_ICON_COLOR,
  getSkillIconKeywords,
  isSkillIconColor,
  SKILL_ICON_COLOR_IDS,
  SKILL_ICON_COLORS,
  SKILL_ICON_IDS,
  type SkillIconColor
} from '@metorial/skill-icons';
import { FloatingPopover, Spinner, theme, Tooltip } from '@metorial/ui';
import { RiSearchLine, RiUpload2Line } from '@remixicon/react';
import type { ReactElement } from 'react';
import { useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { SkillIconGlyph, type SkillImageSelection } from './skillIconTile';

export type SkillImageChange =
  | { type: 'icon'; icon: string; color: SkillIconColor }
  | { type: 'upload'; file: File }
  | { type: 'remove' };

let Tabs = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px 0;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let Tab = styled.button<{ $active: boolean }>`
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-bottom: 2px solid
    ${({ $active }) => ($active ? theme.colors.foreground : 'transparent')};
  background: transparent;
  color: ${({ $active }) => ($active ? theme.colors.foreground : theme.colors.gray650)};
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
`;

let Spacer = styled.span`
  flex: 1;
`;

let LinkButton = styled.button`
  height: 26px;
  margin-bottom: 4px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.gray700};
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray200};
    color: ${theme.colors.foreground};
  }
`;

let Search = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin: 8px 8px 4px;
  padding: 0 10px;
  border: 1px solid ${theme.colors.gray350};
  border-radius: 8px;
  color: ${theme.colors.gray600};

  svg {
    flex: 0 0 auto;
    width: 15px;
    height: 15px;
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: ${theme.colors.foreground};
    font-family: inherit;
    font-size: 13px;
  }

  &:focus-within {
    border-color: ${theme.colors.gray600};
  }
`;

let Swatches = styled.div`
  display: flex;
  gap: 6px;
  padding: 6px 10px 8px;
`;

let Swatch = styled.button<{ $color: string; $active: boolean }>`
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
  background: ${({ $color }) => $color};
  box-shadow: ${({ $active, $color }) =>
    $active ? `0 0 0 2px #fff, 0 0 0 3.5px ${$color}` : 'none'};
  cursor: pointer;
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
  max-height: 232px;
  padding: 0 8px 8px;
  overflow-y: auto;
`;

let GridButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: ${({ $active }) => ($active ? theme.colors.gray250 : 'transparent')};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray250};
  }
`;

let Empty = styled.div`
  padding: 16px 12px 20px;
  color: ${theme.colors.gray650};
  font-size: 12.5px;
  text-align: center;
`;

let Dropzone = styled.button<{ $dragging: boolean }>`
  display: grid;
  place-items: center;
  gap: 4px;
  width: calc(100% - 16px);
  margin: 8px;
  padding: 28px 12px;
  border: 1px dashed
    ${({ $dragging }) => ($dragging ? theme.colors.gray700 : theme.colors.gray500)};
  border-radius: 8px;
  background: ${({ $dragging }) => ($dragging ? theme.colors.gray150 : 'transparent')};
  color: ${theme.colors.gray650};
  font-family: inherit;
  font-size: 12.5px;
  text-align: center;
  cursor: pointer;

  b {
    color: ${theme.colors.foreground};
    font-weight: 500;
  }

  svg {
    width: 20px;
    height: 20px;
  }

  &:disabled {
    cursor: default;
  }
`;

let HiddenInput = styled.input`
  display: none;
`;

export let IconPicker = (p: {
  trigger: ReactElement<Record<string, unknown>>;
  image: SkillImageSelection | null | undefined;
  onChange: (change: SkillImageChange) => Promise<void>;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  let [internalOpen, setInternalOpen] = useState(false);
  let open = p.open ?? internalOpen;
  let setOpen = p.onOpenChange ?? setInternalOpen;

  let currentIcon = p.image?.type == 'icon' ? (p.image.icon ?? null) : null;
  let currentColor =
    p.image?.type == 'icon' && p.image.color && isSkillIconColor(p.image.color)
      ? p.image.color
      : DEFAULT_SKILL_ICON_COLOR;
  let hasImage = !!p.image && p.image.type != 'default';

  let [tab, setTab] = useState<'icons' | 'upload'>(
    p.image?.type == 'file' || p.image?.type == 'url' ? 'upload' : 'icons'
  );
  let [color, setColor] = useState<SkillIconColor>(currentColor);
  let [query, setQuery] = useState('');
  let [busy, setBusy] = useState(false);
  let [dragging, setDragging] = useState(false);
  let fileInputRef = useRef<HTMLInputElement>(null);

  let icons = useMemo(() => {
    let normalized = query.trim().toLowerCase();
    if (!normalized) return SKILL_ICON_IDS;
    return SKILL_ICON_IDS.filter(icon => getSkillIconKeywords(icon).includes(normalized));
  }, [query]);

  let apply = async (change: SkillImageChange, close = true) => {
    setBusy(true);
    try {
      await p.onChange(change);
      if (close) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  let upload = (files: FileList | File[] | null) => {
    let file = files ? Array.from(files)[0] : undefined;
    if (!file || !file.type.startsWith('image/')) return;
    void apply({ type: 'upload', file });
  };

  return (
    <FloatingPopover
      trigger={p.trigger}
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (value) setColor(currentColor);
      }}
      side={p.side}
      align={p.align ?? 'start'}
      width={344}
    >
      <Tabs>
        <Tab $active={tab == 'icons'} onClick={() => setTab('icons')} type="button">
          Icons
        </Tab>
        <Tab $active={tab == 'upload'} onClick={() => setTab('upload')} type="button">
          Upload
        </Tab>
        <Spacer />
        {hasImage ? (
          <LinkButton
            disabled={busy}
            onClick={() => void apply({ type: 'remove' })}
            type="button"
          >
            Remove
          </LinkButton>
        ) : null}
      </Tabs>

      {tab == 'icons' ? (
        <>
          <Search>
            <RiSearchLine />
            <input
              autoFocus
              placeholder="Search icons…"
              value={query}
              onChange={event => setQuery(event.currentTarget.value)}
            />
          </Search>

          <Swatches>
            {SKILL_ICON_COLOR_IDS.map(id => (
              <Tooltip key={id} content={id[0]!.toUpperCase() + id.slice(1)}>
                <Swatch
                  aria-label={id}
                  aria-pressed={color == id}
                  $active={color == id}
                  $color={SKILL_ICON_COLORS[id].foreground}
                  disabled={busy}
                  onClick={() => {
                    setColor(id);
                    if (currentIcon)
                      void apply({ type: 'icon', icon: currentIcon, color: id }, false);
                  }}
                  type="button"
                />
              </Tooltip>
            ))}
          </Swatches>

          {icons.length ? (
            <Grid>
              {icons.map(icon => (
                <GridButton
                  key={icon}
                  aria-label={getSkillIconKeywords(icon)}
                  aria-pressed={currentIcon == icon}
                  $active={currentIcon == icon}
                  disabled={busy}
                  onClick={() => void apply({ type: 'icon', icon, color })}
                  title={getSkillIconKeywords(icon)}
                  type="button"
                >
                  <SkillIconGlyph icon={icon} color={color} size={18} />
                </GridButton>
              ))}
            </Grid>
          ) : (
            <Empty>No icons match “{query}”.</Empty>
          )}
        </>
      ) : (
        <>
          <Dropzone
            $dragging={dragging}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={event => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              upload(event.dataTransfer.files);
            }}
            type="button"
          >
            {busy ? <Spinner /> : <RiUpload2Line />}
            <b>Upload an image</b>
            PNG, JPG or SVG, at least 128×128. Also used as the skill image in discovery.
          </Dropzone>
          <HiddenInput
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
            type="file"
            onChange={event => {
              upload(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
        </>
      )}
    </FloatingPopover>
  );
};
