import { useForm } from '@metorial/data-hooks';
import { ReactNode, createContext, useContext } from 'react';

type FormValues = Record<string, unknown>;
type DashboardForm = ReturnType<typeof useForm<FormValues>>;

export type FormContextForm = Pick<
  DashboardForm,
  'values' | 'submitForm' | 'getFieldProps' | 'setFieldValue' | 'RenderError'
>;

export type FormContextMutator = {
  RenderError: () => ReactNode;
  error: unknown;
  isLoading: boolean;
  isSuccess: boolean;
};

let FormContext = createContext<{
  form: FormContextForm;
  mutators: FormContextMutator[];
  submitName: string | null;
} | null>(null);

export let useFormContext = () => {
  let context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
};

export let FormProvider = FormContext.Provider;
