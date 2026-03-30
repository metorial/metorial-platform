import { useForm } from '@metorial-io/data-hooks';
import { Button, Flex } from '@metorial/ui';
import type { JsonSchema } from '../../../lib/jsonSchema';
import { getDefaultValues, schemaToYup } from '../../../lib/jsonSchema';
import { FormFromSchema } from '../components/formFromSchema';
import { StepContentBlock, StepWrapper } from '../components/stepLayout';

interface ConfigStepProps {
  schema: JsonSchema;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  isSubmitting: boolean;
  isMetorialElement?: boolean;
  extraContent?: React.ReactNode;
  submitLabel?: string;
}

export let ConfigStep = ({
  schema,
  onSubmit,
  isSubmitting,
  isMetorialElement = false,
  extraContent,
  submitLabel = 'Continue'
}: ConfigStepProps) => {
  let form = useForm({
    initialValues: getDefaultValues(schema),
    schema: () => schemaToYup(schema),
    schemaDependencies: [schema],
    onSubmit: async values => {
      await onSubmit(values);
    }
  });

  return (
    <StepWrapper $isMetorialElement={isMetorialElement}>
      <StepContentBlock $isMetorialElement={isMetorialElement}>
        <form onSubmit={form.handleSubmit}>
          <Flex direction="column" gap={20}>
            <FormFromSchema schema={schema} form={form} RenderError={form.RenderError} />
            {extraContent}

            <Button
              type="submit"
              color="black"
              size="2"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {submitLabel}
            </Button>
          </Flex>
        </form>
      </StepContentBlock>
    </StepWrapper>
  );
};
