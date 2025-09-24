import { RiDeleteBin4Line } from '@remixicon/react';
import React, { useEffect, useRef } from 'react';
import { styled } from 'styled-components';
import { Button } from '../button';
import { Error } from '../error';
import { Input, InputDescription, InputLabel } from '../input';
import { Spacer } from '../spacer';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Item = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let ItemInner = styled('div')`
  display: flex;
  gap: 10px;
  align-items: flex-end;
`;

export let TextArrayInput = ({
  value,
  description,
  label,
  error,
  onChange,
  placeholder,
  autoAdd
}: {
  label: string;
  description?: string;
  value: string[];
  placeholder?: string;
  error?: (string | undefined)[] | string;
  onChange: (value: string[]) => void;
  autoAdd?: boolean;
}) => {
  useEffect(() => {
    if (value.length === 0) onChange(['']);
  }, [value]);

  let addedRef = useRef(0);
  useEffect(() => {
    if (Date.now() - addedRef.current < 100) return;
    addedRef.current = Date.now();

    if (autoAdd && value[value.length - 1] !== '') onChange([...value, '']);
  }, [value, autoAdd]);

  return (
    <>
      {label && <InputLabel>{label}</InputLabel>}

      {description && <InputDescription>{label}</InputDescription>}

      {label && ( // Must be after description
        <Spacer height={5} />
      )}

      <Wrapper>
        {value.map((v, i) => (
          <Item key={i}>
            <ItemInner>
              <Input
                value={v}
                placeholder={placeholder}
                onChange={e => {
                  let newValue = [...value];
                  newValue[i] = e.target.value;
                  onChange(newValue);
                }}
                label={label}
                style={{ flexGrow: 1 }}
                size="2"
                hideLabel
              />

              <Button
                onClick={() => onChange(value.filter((_, j) => j != i))}
                title="Remove"
                iconLeft={<RiDeleteBin4Line />}
                size="2"
                variant="soft"
                disabled={value.length === 1}
              />
            </ItemInner>

            {Array.isArray(error) && error[i] && <Error>{error[i]}</Error>}
          </Item>
        ))}

        {!autoAdd && (
          <div
            style={{
              display: 'flex',
              gap: 10
            }}
          >
            <Button size="2" onClick={() => onChange([...value, ''])}>
              Add
            </Button>
          </div>
        )}
      </Wrapper>
    </>
  );
};
