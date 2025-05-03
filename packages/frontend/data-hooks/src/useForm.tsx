import { Error } from '@metorial/ui';
import { ValidationType } from '@metorial/validation';
import equal from 'fast-deep-equal';
import { FormikConfig, useFormik } from 'formik';
import { useEffect, useMemo, useRef } from 'react';
import * as Yup from 'yup';

// any
// array
// boolean
// data
// enum
// intersection
// literal
// null
// number
// object
// record
// string
// union

let validationTypeToYup = (t: ValidationType<any>): Yup.Schema<any> => {
  let elementary = (() => {
    if (t.type == 'any') return Yup.mixed();
    if (t.type == 'boolean') return Yup.boolean();
    if (t.type == 'date') return Yup.date();
    if (t.type == 'enum') return Yup.string().oneOf(t.examples as any[]);
    if (t.type == 'literal') return Yup.mixed().oneOf(t.examples as any[]);
    if (t.type == 'number') return Yup.number();
    if (t.type == 'string') return Yup.string();

    if (t.type == 'array') return Yup.array().of(validationTypeToYup(t.items as any));

    if (t.type == 'object') {
      let shape = Object.fromEntries(
        Object.entries(t.properties!).map(([key, value]) => [key, validationTypeToYup(value)])
      );
      return Yup.object().shape(shape);
    }

    if (t.type == 'union') {
      return Yup.mixed().oneOf([t.items!].flat().map(validationTypeToYup));
    }

    throw new TypeError(`Unsupported validation type: ${t.type}`);
  })();

  if (t.nullable) elementary = elementary.nullable('Value can be null') as any;
  if (!t.optional) elementary = elementary.required('Value is required');

  return elementary;
};

export let useForm = <Values extends {}>(
  opts: Omit<FormikConfig<Values>, 'validationSchema'> & {
    schemaDependencies?: any[];
    typeDependencies?: any[];
    updateInitialValues?: boolean;
    autoSubmit?: { delay?: number };
  } & (
      | { schema: (yup: typeof Yup) => Yup.ObjectSchema<Values> }
      | { type: ValidationType<Values> }
    )
) => {
  let schema = useMemo(
    () => ('schema' in opts ? opts.schema(Yup) : validationTypeToYup(opts.type)),
    [...(opts.schemaDependencies || []), ...(opts.typeDependencies || [])]
  );

  let formik = useFormik({
    ...opts,
    validationSchema: schema
  });

  let RenderError = ({ field }: { field: keyof Values }) => {
    if (!formik.errors[field] || !formik.touched[field]) return null;
    let reason = formik.errors[field]! as string;

    return (
      <Error style={{ marginTop: 6 }} size={12}>
        {reason}
      </Error>
    );
  };

  let prevValues = useRef<Values | undefined>(undefined);
  useEffect(() => {
    if (!opts.updateInitialValues) return;

    if (!equal(prevValues.current, opts.initialValues)) {
      formik.setValues(opts.initialValues);
      prevValues.current = opts.initialValues;
    }
  }, [opts.initialValues, opts.updateInitialValues]);

  let canSubmit = formik.isValid && formik.dirty;
  let canSubmitRef = useRef(canSubmit);
  canSubmitRef.current = canSubmit;

  let autoSubmitTimeoutRef = useRef<number | Timer | NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (opts.autoSubmit && canSubmit) {
      if (autoSubmitTimeoutRef.current) clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = setTimeout(() => {
        if (canSubmitRef.current) {
          formik.submitForm();
        }
      }, opts.autoSubmit.delay ?? 500);
    }
  }, [opts.autoSubmit, canSubmit]);

  return {
    ...formik,
    canSubmit,

    // Prevent formik from showing errors when dialog is closing
    errors: formik.errors as typeof formik.errors,
    RenderError
  };
};
