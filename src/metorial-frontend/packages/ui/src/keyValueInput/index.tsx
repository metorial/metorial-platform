import { RiAddLine, RiDeleteBin4Line, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import React, { useState } from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { ButtonSize, getButtonSize } from '../button/constants';
import { Error } from '../error';
import { Input, InputDescription, InputLabel } from '../input';
import { theme } from '../theme';
import {
  getDuplicateKeys,
  insertKeyValueEntries,
  KeyValueEntry,
  parseKeyValueText
} from './lib';

export * from './lib';

export type KeyValueInputProps = {
  label: React.ReactNode;
  value: KeyValueEntry[];
  onChange: (value: KeyValueEntry[]) => void;
  description?: React.ReactNode;
  hideLabel?: boolean;
  keyLabel?: string;
  valueLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  maxRows?: number;
  masked?: boolean;
  error?: string | (string | undefined)[];
  disabled?: boolean;
  size?: ButtonSize;
};

let emptyEntry: KeyValueEntry = { key: '', value: '' };

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

let Rows = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let Columns = styled('div')<{ $actions: number; $actionWidth: string }>`
  display: grid;
  grid-template-columns:
    minmax(0, 1fr) minmax(0, 1.4fr)
    repeat(${({ $actions }) => $actions}, ${({ $actionWidth }) => $actionWidth});
  gap: 8px;
  align-items: center;
`;

let ColumnLabel = styled(InputLabel).attrs({ as: 'span' })`
  margin-bottom: 0;
`;

let Footer = styled('div')`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
`;

let Count = styled('span')`
  font-size: 12px;
  color: ${theme.colors.gray600};
  font-variant-numeric: tabular-nums;
`;

export let KeyValueInput = ({
  label,
  value,
  onChange,
  description,
  hideLabel,
  keyLabel = 'Key',
  valueLabel = 'Value',
  keyPlaceholder,
  valuePlaceholder,
  addLabel = 'Add',
  maxRows,
  masked,
  error,
  disabled,
  size = '2'
}: KeyValueInputProps) => {
  let [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  let [focusIndex, setFocusIndex] = useState<number | null>(null);
  let [pasteTruncated, setPasteTruncated] = useState(false);

  let isVirtual = value.length == 0;
  let rows = isVirtual ? [emptyEntry] : value;
  let duplicates = getDuplicateKeys(rows);
  let canAdd = !disabled && (maxRows === undefined || rows.length < maxRows);
  let actionCount = masked ? 2 : 1;
  let actionWidth = getButtonSize(size).height;

  let updateRow = (index: number, patch: Partial<KeyValueEntry>) => {
    onChange(rows.map((row, i) => (i == index ? { ...row, ...patch } : row)));
  };

  let removeRow = (index: number) => {
    setRevealed(
      current =>
        new Set([...current].filter(i => i != index).map(i => (i > index ? i - 1 : i)))
    );
    setFocusIndex(null);
    setPasteTruncated(false);
    onChange(rows.filter((_, i) => i != index));
  };

  let addRow = () => {
    if (!canAdd) return;

    setFocusIndex(rows.length);
    onChange([...rows, emptyEntry]);
  };

  let handlePaste = (index: number, field: 'key' | 'value', e: React.ClipboardEvent) => {
    let text = e.clipboardData.getData('text');
    if (!text.includes('=')) return;
    if (field == 'value' && !/\r?\n/.test(text.trim())) return;

    let parsed = parseKeyValueText(text);
    if (!parsed || (field == 'value' && parsed.length < 2)) return;

    e.preventDefault();

    let result = insertKeyValueEntries(rows, index, parsed, maxRows);
    setPasteTruncated(result.truncated);
    onChange(result.entries);
  };

  let getRowError = (row: KeyValueEntry, index: number) => {
    if (Array.isArray(error) && error[index]) return error[index];

    let isLaterDuplicate =
      duplicates.has(row.key) && rows.findIndex(other => other.key == row.key) < index;
    if (isLaterDuplicate) return `Duplicate key "${row.key}".`;

    return undefined;
  };

  return (
    <Wrapper>
      {label && !hideLabel && <InputLabel>{label}</InputLabel>}
      {description && <InputDescription>{description}</InputDescription>}

      <Rows role="group" aria-label={typeof label == 'string' ? label : undefined}>
        <Columns $actions={actionCount} $actionWidth={actionWidth} aria-hidden>
          <ColumnLabel>{keyLabel}</ColumnLabel>
          <ColumnLabel>{valueLabel}</ColumnLabel>
        </Columns>

        {rows.map((row, index) => {
          let rowError = getRowError(row, index);
          let isRevealed = revealed.has(index);

          return (
            <div key={index}>
              <Columns $actions={actionCount} $actionWidth={actionWidth}>
                <Input
                  label={`${keyLabel} ${index + 1}`}
                  hideLabel
                  size={size}
                  value={row.key}
                  placeholder={keyPlaceholder}
                  disabled={disabled}
                  error={duplicates.has(row.key) || !!rowError}
                  autoFocus={index === focusIndex}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={e => updateRow(index, { key: e.target.value })}
                  onPaste={e => handlePaste(index, 'key', e)}
                />

                <Input
                  label={`${valueLabel} ${index + 1}`}
                  hideLabel
                  size={size}
                  value={row.value}
                  placeholder={valuePlaceholder}
                  disabled={disabled}
                  type={masked && !isRevealed ? 'password' : 'text'}
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  onChange={e => updateRow(index, { value: e.target.value })}
                  onPaste={e => handlePaste(index, 'value', e)}
                  onKeyDown={e => {
                    if (e.key != 'Enter' || index != rows.length - 1) return;

                    e.preventDefault();
                    addRow();
                  }}
                />

                {masked && (
                  <Button
                    type="button"
                    size={size}
                    variant="soft"
                    title={isRevealed ? 'Hide Value' : 'Show Value'}
                    aria-label={isRevealed ? 'Hide Value' : 'Show Value'}
                    aria-pressed={isRevealed}
                    iconLeft={isRevealed ? <RiEyeOffLine /> : <RiEyeLine />}
                    onClick={() =>
                      setRevealed(current => {
                        let next = new Set(current);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                  />
                )}

                <Button
                  type="button"
                  size={size}
                  variant="soft"
                  title="Remove"
                  aria-label="Remove"
                  iconLeft={<RiDeleteBin4Line />}
                  disabled={disabled || isVirtual}
                  onClick={() => removeRow(index)}
                />
              </Columns>

              {rowError && (
                <Error size={12} style={{ marginTop: 6 }}>
                  {rowError}
                </Error>
              )}
            </div>
          );
        })}
      </Rows>

      <Footer>
        <Button
          type="button"
          size={size}
          variant="outline"
          iconLeft={<RiAddLine />}
          disabled={!canAdd}
          onClick={addRow}
        >
          {addLabel}
        </Button>

        {maxRows !== undefined && (
          <Count>
            {rows.length} / {maxRows}
          </Count>
        )}
      </Footer>

      {pasteTruncated && maxRows !== undefined && (
        <Error size={12} style={{ marginTop: 6 }}>
          {`Only the first ${maxRows} entries were kept.`}
        </Error>
      )}

      {typeof error == 'string' && (
        <Error size={12} style={{ marginTop: 6 }}>
          {error}
        </Error>
      )}
    </Wrapper>
  );
};
