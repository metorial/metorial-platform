import { indexProviderAuthMethodsQueue } from './providerAuthMethod';
import { indexProviderToolsQueue } from './providerTool';

export let SPEC_SEARCH_INDEX_DELAY_MS = 10_000;

export let enqueueProviderSpecSearchIndex = async (d: {
  providerId: string;
  delay?: number;
}) => {
  await indexProviderToolsQueue.add(
    { providerId: d.providerId },
    { id: d.providerId, delay: d.delay }
  );
  await indexProviderAuthMethodsQueue.add(
    { providerId: d.providerId },
    { id: d.providerId, delay: d.delay }
  );
};
