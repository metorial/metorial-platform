import { Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';

export let SandboxPagePlaceholder = ({ title }: { title: string }) => (
  <Box title={title}>
    <Text size="2" color="gray600">
      Coming soon.
    </Text>
  </Box>
);
