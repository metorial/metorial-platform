import { ValidationType } from '@lowerdeck/validation';
import { useForm } from '@metorial/data-hooks';
import { FormikConfig } from 'formik';
import React from 'react';
import * as Yup from 'yup';
import { FormContextMutator, FormProvider } from './context';
import { FormWrapper } from './formWrapper';

export type FormProps<Values extends Record<string, unknown>> = Omit<
  FormikConfig<Values>,
  'validationSchema'
> & {
  schemaDependencies?: unknown[];
  typeDependencies?: unknown[];
  updateInitialValues?: boolean;
  autoSubmit?: { delay?: number };
  actionsWrapper?: ({ children }: { children: React.ReactNode }) => React.ReactNode;
  gap?: number;
} & (
    | { schema: (yup: typeof Yup) => Yup.ObjectSchema<Values> }
    | { type: ValidationType<Values> }
  ) & {
    children:
      | React.ReactNode
      | ((form: ReturnType<typeof useForm<Values, any>>) => React.ReactNode);
    submitName?: string | null;
    mutators: FormContextMutator[];
  };

export let Form = <Values extends Record<string, unknown>>(p: FormProps<Values>) => {
  let form = useForm(p);

  let children = typeof p.children === 'function' ? p.children(form) : p.children;

  return React.createElement(
    FormProvider,
    {
      value: {
        form,
        submitName: p.submitName ?? null,
        mutators: p.mutators ?? []
      }
    },
    React.createElement(
      FormWrapper,
      {
        actionsWrapper: p.actionsWrapper,
        gap: p.gap
      },
      children
    )
  );
};
