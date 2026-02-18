import { useCurrentInstance, useSession } from '@metorial/state';
import { Text } from '@metorial/ui';
import { useParams } from 'react-router-dom';

export let SessionPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return (
    <Text size="2" color="gray600">
      Session events view has been removed. Use the provider session logs instead.
    </Text>
  );
};
