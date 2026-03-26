import { useForm } from '@metorial-io/data-hooks';
import { Button, Flex } from '@metorial-io/ui';
import type { JsonSchema } from '../../../lib/jsonSchema';
import { getDefaultValues, schemaToYup } from '../../../lib/jsonSchema';
import { FormFromSchema } from '../components/FormFromSchema';
import { SecuredByFooter, StepContentBlock, StepWrapper } from '../components/StepLayout';

interface AuthConfigStepProps {
  schema: JsonSchema;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  isSubmitting: boolean;
  isMetorialElement?: boolean;
}

export let AuthConfigStep = ({
  schema,
  onSubmit,
  isSubmitting,
  isMetorialElement = false
}: AuthConfigStepProps) => {
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

            <Button
              type="submit"
              color="black"
              size="3"
              fullWidth
              loading={isSubmitting}
              disabled={!form.isValid}
            >
              Connect
            </Button>
          </Flex>
        </form>

        <SecuredByFooter isMetorialElement={isMetorialElement} />
      </StepContentBlock>
    </StepWrapper>
  );
};
