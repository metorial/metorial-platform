import { useForm, useMutation } from '@metorial/data-hooks';
import { createContext, useContext } from 'react';

let FormContext = createContext<{
  form: ReturnType<typeof useForm>;
  mutators: ReturnType<typeof useMutation>[];
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
