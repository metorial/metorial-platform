import { useForm } from '@metorial/data-hooks';
import { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { useFormContext } from './context';

let Wrapper = styled.fieldset`
  display: flex;
  flex-direction: column;
  padding: 0px;
  border: none;
  margin: 0px;
  width: 100%;
  max-width: 100%;
`;

export let Field = (p: {
  field: string;
  children: (d: {
    form: ReturnType<typeof useForm>;
    getFieldProps: () => ReturnType<ReturnType<typeof useForm>['getFieldProps']>;
    value: any;
    setValue: (value: any) => void;
  }) => React.ReactNode;
}) => {
  let { form } = useFormContext();

  let getFieldProps = useCallback(() => form.getFieldProps(p.field), [form, p.field]);
  let value = form.values[p.field as keyof typeof form.values];
  let setValue = useCallback(
    (value: any) => {
      form.setFieldValue(p.field, value);
    },
    [form, p.field]
  );

  let Children = useMemo(() => p.children, []);

  return (
    <Wrapper>
      <Children form={form} getFieldProps={getFieldProps} value={value} setValue={setValue} />
      <form.RenderError field={p.field as never} />
    </Wrapper>
  );
};
