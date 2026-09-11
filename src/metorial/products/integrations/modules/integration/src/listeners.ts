import type {
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationProvider
} from '@metorial-subspace/db';

export type IntegrationTransactionEvent =
  | {
      kind: 'integration.created' | 'integration.updated' | 'integration.archived';
      integration: Integration;
    }
  | {
      kind:
        | 'integrationProvider.created'
        | 'integrationProvider.updated'
        | 'integrationProvider.archived';
      integration: Integration;
      integrationProvider: IntegrationProvider;
    }
  | {
      kind: 'integrationInstance.created' | 'integrationInstance.updated' | 'integrationInstance.archived';
      integration: Integration;
      integrationInstance: IntegrationInstance;
    }
  | {
      kind: 'integrationInstanceProvider.set' | 'integrationInstanceProvider.archived';
      integrationInstance: IntegrationInstance;
      integrationInstanceProvider: IntegrationInstanceProvider;
    };

export type IntegrationTransactionListener = {
  onEvent(event: IntegrationTransactionEvent): Promise<void>;
};

let listeners: IntegrationTransactionListener[] = [];

export let registerIntegrationTransactionListener = (
  listener: IntegrationTransactionListener
) => {
  listeners.push(listener);
};

export let notifyIntegrationTransaction = async (event: IntegrationTransactionEvent) => {
  for (let listener of listeners) {
    await listener.onEvent(event);
  }
};
