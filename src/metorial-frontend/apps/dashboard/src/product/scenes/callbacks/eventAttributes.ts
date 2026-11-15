// Integrations mark the trigger output fields that are stored with each event for filtering.
let EVENT_ATTRIBUTE_SCHEMA_KEY = 'x-slates-event-attribute';

type TriggerWithOutputSchema = {
  outputSchema?: { schema?: Record<string, any> | null } | null;
};

export let eventAttributeKeys = (triggers: TriggerWithOutputSchema[]) => {
  let keys = new Set<string>();

  for (let trigger of triggers) {
    let properties: Record<string, any> = trigger.outputSchema?.schema?.properties ?? {};
    for (let [key, property] of Object.entries(properties)) {
      if (property?.[EVENT_ATTRIBUTE_SCHEMA_KEY] === true) keys.add(key);
    }
  }

  return [...keys].sort();
};

let splitAttribute = (attribute: string) => {
  let separator = attribute.indexOf(':');
  if (separator <= 0) return null;

  return { key: attribute.slice(0, separator), value: attribute.slice(separator + 1) };
};

export let eventAttributeLabel = (attribute: string) => {
  let parts = splitAttribute(attribute);
  return parts ? `${parts.key} is ${parts.value}` : attribute;
};

// The typed text is a value; each option applies it to one field. `key:value` picks the field.
export let eventAttributeOptions = (keys: string[], search: string) => {
  let text = search.trim();
  if (!text) return [];

  let typed = splitAttribute(text);
  if (typed && keys.includes(typed.key)) {
    return typed.value ? [{ id: text, label: eventAttributeLabel(text) }] : [];
  }

  return keys.map(key => ({
    id: `${key}:${text}`,
    label: eventAttributeLabel(`${key}:${text}`)
  }));
};

export let formatEventAttributes = (attributes: Record<string, string[]> | null | undefined) =>
  Object.entries(attributes ?? {}).flatMap(([key, values]) =>
    values.map(value => `${key}: ${value}`)
  );
