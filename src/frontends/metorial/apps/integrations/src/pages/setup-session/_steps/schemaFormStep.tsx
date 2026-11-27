import { useForm, type useMutation } from '@metorial/data-hooks';
import { Button, Flex } from '@metorial/ui';
import type { ReactNode } from 'react';
import { SchemaForm } from '../../../components/schemaForm';
import { StepContainer } from '../../../components/stepContainer';
import { getDefaultValues, schemaToYup, type JsonSchema } from '../../../lib/jsonSchema';

let emptySchema: JsonSchema = { type: 'object', properties: {} };

export let SchemaFormStep = ({
  schema,
  mutation,
  submitLabel,
  children,
  footer
}: {
  schema: JsonSchema | null;
  mutation: ReturnType<typeof useMutation<Record<string, unknown>, void>>;
  submitLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
}) => {
  let effectiveSchema = schema ?? emptySchema;

  let form = useForm({
    initialValues: getDefaultValues(effectiveSchema),
    schema: () => schemaToYup(effectiveSchema),
    schemaDependencies: [effectiveSchema],
    onSubmit: async values => {
      await mutation.mutate(values);
    }
  });

  return (
    <StepContainer>
      <form onSubmit={form.handleSubmit}>
        <Flex direction="column" gap={20}>
          <SchemaForm schema={effectiveSchema} form={form} />

          {children}

          <Button
            type="submit"
            size="2"
            fullWidth
            loading={mutation.isLoading}
            success={mutation.isSuccess}
          >
            {submitLabel}
          </Button>

          <mutation.RenderError />

          {footer}
        </Flex>
      </form>
    </StepContainer>
  );
};
