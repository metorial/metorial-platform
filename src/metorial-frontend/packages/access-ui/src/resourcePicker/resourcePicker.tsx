import { RiErrorWarningLine } from '@remixicon/react';
import { Button, Input, Panel, theme, toast } from '@metorial/ui';
import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { AccessEmpty, AccessList, AccessListMore } from '../accessList';
import {
  PickerCreateRow,
  PickerFooter,
  PickerRow,
  PickerSectionLabel,
  PickerSkeletonRows,
  type PickerRowTone
} from '../picker';
import { isSelectionReady } from './selection';
import { PickerSelectionTray } from './selectionTray';
import type { PickerItem, PickerSelection, PickerSource, PickerSubmitResult } from './types';
import type { ResourcePickerState } from './useResourcePicker';

let iconSize = 32;

let subjectSize = 28;

let KeyScope = styled.div`
  display: contents;
`;

let TitleRow = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;

  & > :first-child {
    flex: 1 1 220px;
  }
`;

let Items = styled.div`
  --access-inline: 20px;
  margin: 0 -20px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let Muted = styled.span`
  font-weight: 400;
  color: ${theme.colors.gray600};
`;

let Failed = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${theme.colors.red900};
`;

let EmptyActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
`;

export let ResourcePicker = <V,>(p: {
  picker: ResourcePickerState<V>;
  title: React.ReactNode;
  description?: React.ReactNode;
  subject?: (size: number) => React.ReactNode;
  placeholder: string;
  toolbar?: React.ReactNode;
  create?: { label: string; onClick: () => void };
  source: PickerSource<V>;
  empty?: { title: React.ReactNode; description?: React.ReactNode };
  verb: string;
  success: (count: number) => string;
  notice?: React.ReactNode;
  onSubmit: (selected: PickerSelection<V>[]) => Promise<PickerSubmitResult>;
  close: () => void;
}) => {
  let { picker, source } = p;
  let scopeRef = useRef<HTMLDivElement>(null);
  let [submitting, setSubmitting] = useState(false);

  let count = picker.selected.length;
  let failedCount = picker.failedKeys.length;
  let canSubmit = count > 0 && !picker.pending.length && !submitting;

  let rowElement = (key: string) =>
    scopeRef.current?.querySelector<HTMLElement>(`[data-picker-row="${CSS.escape(key)}"]`);

  let jump = (key: string) => {
    if (picker.get(key)?.item.settings) picker.setOpen(key);

    requestAnimationFrame(() => {
      let row = rowElement(key);
      row?.scrollIntoView({ block: 'nearest' });
      row?.focus({ preventScroll: true });
    });
  };

  let submit = async () => {
    if (!canSubmit) return;

    let selected = picker.selected;
    setSubmitting(true);

    let result: PickerSubmitResult;
    try {
      result = await p.onSubmit(selected);
    } finally {
      setSubmitting(false);
    }

    let failed = result?.failed ?? [];
    if (failed.length) {
      picker.keepFailed(failed);
      toast.error(`${failed.length} of ${selected.length} failed. They're still selected.`);
      return;
    }

    toast.success(p.success(selected.length));
    p.close();
  };

  let statusOf = (
    item: PickerItem<V>
  ): { tone: PickerRowTone; text: React.ReactNode } | undefined => {
    let selection = picker.get(item.key);
    if (!selection) return undefined;

    if (picker.failedKeys.includes(item.key)) {
      return { tone: 'failed', text: `Couldn't ${p.verb.toLowerCase()}. Still selected.` };
    }

    let settings = item.settings;
    if (!settings) return undefined;
    if (!isSelectionReady(selection)) return { tone: 'needs', text: settings.needs };

    let summary = settings.summary(selection.value);
    return summary == null ? undefined : { tone: 'done', text: summary };
  };

  let renderRow = (item: PickerItem<V>) => {
    let selection = picker.get(item.key);
    let settings = item.settings;
    let open = picker.openKey == item.key;

    return (
      <PickerRow
        key={item.key}
        rowKey={item.key}
        selected={!!selection}
        onSelectedChange={on => picker.toggle(item, on)}
        icon={item.icon(iconSize)}
        title={item.title}
        subtitle={item.subtitle}
        status={statusOf(item)}
        right={item.kind}
        expandable={!!settings}
        open={open}
        onOpenChange={next => picker.setOpen(next ? item.key : null)}
        back={open && picker.back ? picker.back : undefined}
      >
        {selection && settings
          ? settings.render(selection.value, {
              set: value => picker.setValue(item.key, value),
              close: () => picker.setOpen(null),
              setBack: picker.setBack
            })
          : null}
      </PickerRow>
    );
  };

  let visibleKeys = new Set(source.items.map(item => item.key));
  let pinned = picker.selected.filter(selection => !visibleKeys.has(selection.item.key));
  let isEmpty = !source.isLoading && !source.error && !source.items.length;

  let renderBody = () => {
    if (source.error) {
      return (
        <AccessEmpty
          title="Couldn't load results."
          action={
            source.retry ? (
              <Button type="button" variant="outline" size="1" onClick={source.retry}>
                Try Again
              </Button>
            ) : undefined
          }
        />
      );
    }

    if (source.isLoading && !source.items.length) return <PickerSkeletonRows />;

    if (isEmpty && picker.query) {
      return (
        <AccessEmpty
          title={`No results for "${picker.query}"`}
          description="Check the spelling or try a different filter."
          action={
            <EmptyActions>
              <Button
                type="button"
                variant="outline"
                size="1"
                onClick={() => picker.setSearch('')}
              >
                Clear Search
              </Button>
              {p.create ? (
                <Button type="button" variant="outline" size="1" onClick={p.create.onClick}>
                  {p.create.label}
                </Button>
              ) : null}
            </EmptyActions>
          }
        />
      );
    }

    if (isEmpty && !pinned.length) {
      return (
        <AccessEmpty
          title={p.empty?.title ?? 'Nothing left to add.'}
          description={p.empty?.description}
          action={
            p.create ? (
              <Button type="button" variant="outline" size="1" onClick={p.create.onClick}>
                {p.create.label}
              </Button>
            ) : undefined
          }
        />
      );
    }

    return source.items.map(renderRow);
  };

  let status = !count ? (
    'Nothing selected'
  ) : picker.pending.length ? (
    <>
      {count} selected ·
      <Button
        variant="ghost"
        size="1"
        type="button"
        onClick={() => jump(picker.pending[0]!.item.key)}
      >
        {picker.pending.length == 1
          ? `${picker.pending[0]!.item.title} needs a choice`
          : `${picker.pending.length} need a choice`}
      </Button>
    </>
  ) : failedCount ? (
    <Failed>
      <RiErrorWarningLine size={14} />
      {failedCount} failed
    </Failed>
  ) : (
    `${count} selected`
  );

  return (
    <KeyScope
      ref={scopeRef}
      onKeyDown={e => {
        if ((e.metaKey || e.ctrlKey) && e.key == 'Enter') {
          e.preventDefault();
          submit();
          return;
        }

        if (e.key != 'ArrowDown' && e.key != 'ArrowUp') return;

        let target = e.target as HTMLElement;
        if (!target.hasAttribute('data-picker-row')) return;

        let rows = [
          ...(scopeRef.current?.querySelectorAll<HTMLElement>(
            '[data-picker-row][tabindex="0"]'
          ) ?? [])
        ];
        let next = rows[rows.indexOf(target) + (e.key == 'ArrowDown' ? 1 : -1)];
        if (!next) return;

        e.preventDefault();
        next.focus();
      }}
    >
      <Panel.Header>
        <Panel.Title>
          <TitleRow>
            {p.subject?.(subjectSize)}
            {p.title}
          </TitleRow>
        </Panel.Title>
        {p.description ? <Panel.Description>{p.description}</Panel.Description> : null}
      </Panel.Header>

      <Panel.Content>
        <Toolbar>
          <Input
            label="Search"
            hideLabel
            placeholder={p.placeholder}
            value={picker.search}
            onInput={picker.setSearch}
          />
          {p.toolbar}
        </Toolbar>

        <Items>
          <AccessList>
            {p.create && !isEmpty && !source.error ? (
              <PickerCreateRow onClick={p.create.onClick}>{p.create.label}</PickerCreateRow>
            ) : null}

            {pinned.length ? (
              <>
                <PickerSectionLabel>
                  Selected <Muted>· not in current results</Muted>
                </PickerSectionLabel>
                {pinned.map(selection => renderRow(selection.item))}
                {source.items.length || source.isLoading ? (
                  <PickerSectionLabel>Results</PickerSectionLabel>
                ) : null}
              </>
            ) : null}

            {renderBody()}

            {source.hasMore && source.loadMore ? (
              <AccessListMore onClick={source.loadMore} loading={source.isLoadingMore}>
                Load More
              </AccessListMore>
            ) : null}
          </AccessList>
        </Items>

        {p.notice}

        <PickerFooter
          status={status}
          tray={
            <PickerSelectionTray
              selected={picker.selected}
              failedKeys={picker.failedKeys}
              onJump={jump}
              onRemove={picker.remove}
            />
          }
        >
          <Button
            type="button"
            variant="outline"
            size="2"
            disabled={submitting}
            onClick={p.close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="2"
            disabled={!count || !!picker.pending.length}
            loading={submitting}
            onClick={submit}
          >
            {failedCount ? 'Retry' : p.verb}
          </Button>
        </PickerFooter>
      </Panel.Content>
    </KeyScope>
  );
};
