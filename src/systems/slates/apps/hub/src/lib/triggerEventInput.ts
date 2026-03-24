export type TriggerEventInputPayload = {
  id: string;
  input: Record<string, any> | null;
  createdAt: Date;
};

export let getTriggerEventInputStorageKey = (eventInputId: string) => {
  return `trigger-event-inputs/${eventInputId}/payload`;
};
