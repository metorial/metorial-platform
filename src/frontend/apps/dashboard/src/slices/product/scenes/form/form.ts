import { useForm } from '@metorial/data-hooks';
import { ValidationType } from '@metorial/validation';
import { FormikConfig } from 'formik';
import React from 'react';
import * as Yup from 'yup';
import { FormProvider } from './context';
import { FormWrapper } from './formWrapper';

export type FormProps<Values extends {}> = Omit<FormikConfig<Values>, 'validationSchema'> & {
  schemaDependencies?: any[];
  typeDependencies?: any[];
  updateInitialValues?: boolean;
  autoSubmit?: { delay?: number };
} & (
    | { schema: (yup: typeof Yup) => Yup.ObjectSchema<Values> }
    | { type: ValidationType<Values> }
  ) & {
    children: React.ReactNode;
    submitName?: string | null;
    mutators: {
      RenderError: () => React.ReactNode;
      error: any;
      isLoading: boolean;
      isSuccess: boolean;
    }[];
  };

export let Form = <Values extends {}>(p: FormProps<Values>) => {
  let form = useForm(p);

  return React.createElement(
    FormProvider,
    {
      value: {
        form: form as any,
        submitName: p.submitName ?? null,
        mutators: (p.mutators ?? []) as any
      }
    },
    React.createElement(FormWrapper, {}, p.children)
  );
};
