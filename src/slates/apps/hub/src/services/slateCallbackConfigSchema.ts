export type CallbackConfigJsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'string'; title: string }>;
  required: string[];
  additionalProperties: false;
};

let getAllowedCallbackSecretRefs = (action: { spec: unknown }) => {
  let spec = action.spec as Record<string, any>;
  let ingress = spec.invocation?.http?.ingress;
  if (
    !ingress ||
    (ingress.kind !== 'receiver_route' && ingress.kind !== 'shared_provisioned_app')
  ) {
    return [];
  }

  let refs = ingress.verification?.allowedSecretRefs;
  if (!Array.isArray(refs)) return [];
  return refs.filter(
    (ref): ref is { source: 'callback_secret'; callbackSecretKey: string; name: string } =>
      ref?.source === 'callback_secret' &&
      typeof ref.callbackSecretKey === 'string' &&
      ref.callbackSecretKey.length > 0 &&
      typeof ref.name === 'string' &&
      ref.name.length > 0
  );
};

export let buildCallbackConfigSchemaForActions = (
  actions: { spec: unknown }[]
): CallbackConfigJsonSchema | null => {
  let refsByKey = new Map<
    string,
    { source: 'callback_secret'; callbackSecretKey: string; name: string }
  >();
  for (let action of actions) {
    for (let reference of getAllowedCallbackSecretRefs(action)) {
      if (!refsByKey.has(reference.callbackSecretKey)) {
        refsByKey.set(reference.callbackSecretKey, reference);
      }
    }
  }
  if (refsByKey.size === 0) return null;

  let refs = [...refsByKey.values()].sort((first, second) =>
    first.callbackSecretKey.localeCompare(second.callbackSecretKey)
  );
  return {
    type: 'object',
    properties: Object.fromEntries(
      refs.map(reference => [
        reference.callbackSecretKey,
        { type: 'string' as const, title: reference.name }
      ])
    ),
    required: refs.map(reference => reference.callbackSecretKey),
    additionalProperties: false
  };
};

export let mergeCallbackConfigValues = (
  schema: CallbackConfigJsonSchema,
  previousValues: Record<string, string>,
  valuesPatch: Record<string, string>
) => ({
  ...Object.fromEntries(
    schema.required.flatMap(key =>
      typeof previousValues[key] === 'string' ? [[key, previousValues[key]]] : []
    )
  ),
  ...valuesPatch
});

export let getMissingCallbackConfigKeys = (
  schema: CallbackConfigJsonSchema,
  values: Record<string, string>
) => schema.required.filter(key => !Object.prototype.hasOwnProperty.call(values, key));
