import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RiArrowLeftLine, RiSearchLine } from '@remixicon/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import React, { useEffect, useId, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { InputDescription, InputLabel } from '../input';
import { Spinner } from '../spinner';
import { theme } from '../theme';

export type SelectListItem = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
};

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

let ListBox = styled('div')`
  position: relative;
  width: 100%;
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
  overflow: hidden;
`;

let ScrollArea = styled('div')<{ $maxHeight?: number }>`
  max-height: ${p => (p.$maxHeight ? `${p.$maxHeight}px` : 'none')};
  overflow-y: ${p => (p.$maxHeight ? 'auto' : 'visible')};
`;

let SearchBar = styled('div')`
  padding: 8px;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.gray300};
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
`;

let SearchField = styled('label')`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border-radius: 7px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray700};
  outline: 1px solid transparent;
  transition:
    background 0.2s ease,
    outline-color 0.2s ease;

  &:focus-within {
    background: ${theme.colors.gray300};
    outline-color: ${theme.colors.gray500};
  }
`;

let SearchInput = styled('input')`
  flex-grow: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: ${theme.colors.foreground};

  &::placeholder {
    color: ${theme.colors.gray600};
  }
`;

let SpinnerSlot = styled('div')<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  flex-shrink: 0;
  opacity: ${p => (p.$visible ? 1 : 0)};
  transform: scale(${p => (p.$visible ? 1 : 0.85)});
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  pointer-events: none;
`;

let Group = styled(RadioGroup)`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

let RowWrapper = styled(motion.div)`
  position: relative;
  overflow: hidden;

  & + & {
    box-shadow: inset 0 1px 0 ${theme.colors.gray300};
  }
`;

let Row = styled(Radio.Root)<{ $reserveEnd: boolean }>`
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: flex-start;
  width: 100%;
  padding: 14px ${p => (p.$reserveEnd ? '96px' : '18px')} 14px 18px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  outline: none;
  transition: background 0.18s ease;

  &:hover {
    background: ${theme.colors.gray100};
  }

  &:focus-visible {
    background: ${theme.colors.gray100};
    box-shadow: inset 0 0 0 1px ${theme.colors.gray500};
  }

  &[data-checked] {
    background: ${theme.colors.gray200};
  }

  &[data-disabled] {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

let Indicator = styled('span')`
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 999px;
  border: 1.5px solid ${theme.colors.gray500};
  background: ${theme.colors.background};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s ease;

  ${Row}[data-checked] & {
    border-color: ${theme.colors.primary};
  }
`;

let IndicatorDot = styled(Radio.Indicator)`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${theme.colors.primary};
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;

  &[data-unchecked] {
    opacity: 0;
    transform: scale(0.6);
  }
`;

let RowContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
`;

let RowLabel = styled('div')`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  color: ${theme.colors.gray900};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let RowDescription = styled('div')`
  font-size: 12px;
  line-height: 1.35;
  color: ${theme.colors.gray600};
`;

let RowBadge = styled('div')`
  display: flex;
  align-items: center;
  align-self: center;
`;

let BackSlot = styled('div')`
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  z-index: 1;
`;

let PaginationBar = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let Empty = styled('div')`
  padding: 18px;
  font-size: 13px;
  color: ${theme.colors.gray600};
  text-align: center;
`;

let useDebouncedCallback = (callback: ((value: string) => void) | undefined, delay: number) => {
  let callbackRef = useRef(callback);
  callbackRef.current = callback;
  let timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  let [isPending, setIsPending] = useState(false);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  let schedule = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPending(true);
    timeoutRef.current = setTimeout(() => {
      setIsPending(false);
      callbackRef.current?.(value);
    }, delay);
  };

  return { schedule, isPending };
};

export let SelectList = (p: {
  items: SelectListItem[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  label?: React.ReactNode;
  hideLabel?: boolean;
  ariaLabel?: string;
  description?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
  empty?: React.ReactNode;
  maxHeight?: number;
  pagination?: {
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
  };
  collapseOn?: string[];
  collapsed?: boolean;
  backLabel?: string;
  onBack?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) => {
  let id = useId();
  let labelId = `${id}-label`;
  let descriptionId = `${id}-description`;
  let reduceMotion = useReducedMotion();
  let [search, setSearch] = useState('');
  let debouncedSearch = useDebouncedCallback(p.onSearchChange, p.searchDebounceMs ?? 300);
  let groupRef = useRef<HTMLDivElement | null>(null);
  let [pageDirection, setPageDirection] = useState<'previous' | 'next' | null>(null);

  useEffect(() => {
    if (!p.isLoading) setPageDirection(null);
  }, [p.isLoading]);

  let collapseOn = p.collapseOn ?? [];
  let isCollapsed = p.collapsed ?? (!!p.value && collapseOn.includes(p.value));
  let visibleItems = isCollapsed ? p.items.filter(item => item.id == p.value) : p.items;
  let transition = { duration: reduceMotion ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] as const };

  let handleBack = () => {
    if (p.onBack) p.onBack();
    else p.onChange(null);

    requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
    });
  };

  return (
    <Wrapper>
      {p.label &&
        (p.hideLabel ? (
          <VisuallyHidden>
            <span id={labelId}>{p.label}</span>
          </VisuallyHidden>
        ) : (
          <InputLabel as="div" id={labelId}>
            {p.label}
          </InputLabel>
        ))}

      {p.description && <InputDescription id={descriptionId}>{p.description}</InputDescription>}

      <ListBox>
        <ScrollArea $maxHeight={isCollapsed ? undefined : p.maxHeight}>
          <AnimatePresence initial={false}>
            {p.searchable && !isCollapsed && (
              <motion.div
                key="search"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transition}
                style={{ position: 'sticky', top: 0, zIndex: 2 }}
              >
                <SearchBar>
                  <SearchField>
                    <RiSearchLine size={14} aria-hidden />
                    <SearchInput
                      type="search"
                      value={search}
                      placeholder={p.searchPlaceholder ?? 'Search'}
                      aria-label={p.searchPlaceholder ?? 'Search'}
                      disabled={p.disabled}
                      onChange={e => {
                        setSearch(e.target.value);
                        debouncedSearch.schedule(e.target.value.trim());
                      }}
                    />
                    <SpinnerSlot
                      $visible={!!p.isLoading || debouncedSearch.isPending}
                      aria-hidden
                    >
                      <Spinner size={14} foreground={theme.colors.gray700} background="transparent" />
                    </SpinnerSlot>
                  </SearchField>
                </SearchBar>
              </motion.div>
            )}
          </AnimatePresence>

          <Group
            ref={groupRef}
            value={p.value ?? null}
            disabled={p.disabled}
            aria-label={!p.label ? p.ariaLabel : undefined}
            aria-labelledby={p.label ? labelId : undefined}
            aria-describedby={p.description ? descriptionId : undefined}
            onValueChange={(value, details) => {
              let nextValue = value as string;
              let isExplicitActivation =
                typeof PointerEvent != 'undefined' && details.event instanceof PointerEvent;

              if (collapseOn.includes(nextValue) && !isExplicitActivation) return;
              if (nextValue == p.value) return;

              p.onChange(nextValue);
            }}
          >
            <AnimatePresence initial={false}>
              {visibleItems.map(item => (
                <RowWrapper
                  key={item.id}
                  layout="position"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transition}
                >
                  <Row value={item.id} disabled={item.disabled} $reserveEnd={isCollapsed}>
                    <Indicator aria-hidden>
                      <IndicatorDot keepMounted />
                    </Indicator>

                    <RowContent>
                      <RowLabel>{item.label}</RowLabel>
                      {item.description && <RowDescription>{item.description}</RowDescription>}
                    </RowContent>

                    {item.badge && !isCollapsed ? <RowBadge>{item.badge}</RowBadge> : <span />}
                  </Row>

                  {isCollapsed && (
                    <BackSlot>
                      <Button
                        type="button"
                        size="1"
                        variant="outline"
                        iconLeft={<RiArrowLeftLine />}
                        disabled={p.disabled}
                        onClick={handleBack}
                      >
                        {p.backLabel ?? 'Back'}
                      </Button>
                    </BackSlot>
                  )}
                </RowWrapper>
              ))}
            </AnimatePresence>
          </Group>

          {visibleItems.length == 0 && !p.isLoading && (
            <Empty>{p.empty ?? 'No results found.'}</Empty>
          )}
        </ScrollArea>

        {p.pagination &&
          !isCollapsed &&
          (p.pagination.hasPrevious || p.pagination.hasNext) && (
            <PaginationBar>
              <Button
                type="button"
                size="1"
                variant="outline"
                disabled={!p.pagination.hasPrevious || !!p.isLoading}
                loading={!!p.isLoading && pageDirection == 'previous'}
                onClick={() => {
                  setPageDirection('previous');
                  p.pagination?.onPrevious();
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="1"
                variant="outline"
                disabled={!p.pagination.hasNext || !!p.isLoading}
                loading={!!p.isLoading && pageDirection == 'next'}
                onClick={() => {
                  setPageDirection('next');
                  p.pagination?.onNext();
                }}
              >
                Next
              </Button>
            </PaginationBar>
          )}
      </ListBox>

      <AnimatePresence initial={false}>
        {isCollapsed && p.children && (
          <motion.div
            key="collapsed-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 16 }}>{p.children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};
