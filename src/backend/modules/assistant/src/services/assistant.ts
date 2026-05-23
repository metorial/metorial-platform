import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { type Instance } from '@metorial/db';
import { ensureSynthesisScope, synthesis } from '../synthesis';

export type AssistantModelWithProvider = NonNullable<
  Awaited<ReturnType<typeof synthesis.assistant.get>>['defaultModel']
>;

export type AvailableAssistant = Awaited<ReturnType<typeof synthesis.assistant.get>>;
export type AssistantWithRelations = AvailableAssistant;

class AssistantServiceImpl {
  async getAvailableAssistant(d: {
    instance: Instance;
    assistantId: string;
  }) {
    let scope = await ensureSynthesisScope({
      instance: d.instance
    });

    return await synthesis.assistant.get({
      tenantId: scope.tenantId,
      assistantId: d.assistantId
    });
  }

  async getAvailableAssistantsByIds(d: {
    instance: Instance;
    assistantIds: string[];
  }) {
    let assistantIds = Array.from(new Set(d.assistantIds));
    if (!assistantIds.length) return new Map<string, AvailableAssistant>();

    let assistants = await Promise.all(
      assistantIds.map(async assistantId =>
        [
          assistantId,
          await this.getAvailableAssistant({
            instance: d.instance,
            assistantId
          })
        ] as const
      )
    );

    return new Map<string, AvailableAssistant>(assistants);
  }

  async listAvailableAssistants(d: { instance: Instance }) {
    let scope = await ensureSynthesisScope({
      instance: d.instance
    });

    return Paginator.create(() => async input => {
      let result = await synthesis.assistant.list({
        tenantId: scope.tenantId,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }
}

export let assistantService = Service.create(
  'assistantService',
  () => new AssistantServiceImpl()
).build();
