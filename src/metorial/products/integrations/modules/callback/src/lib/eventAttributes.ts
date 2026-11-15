import { badRequestError, ServiceError } from '@lowerdeck/error';
import { type ValidationType, v } from '@lowerdeck/validation';

let maxKeys = 8;
let maxValuesPerKey = 16;
let maxValueLength = 256;
let keyPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export type EventAttributes = Record<string, string[]>;

type EventAttribute = { key: string; value: string };

let attributeValuesValidator = v.record(
  v.array(
    v.string({
      modifiers: [
        v.minLength(1, { message: 'Attribute values must not be empty' }),
        v.maxLength(maxValueLength, {
          message: `Attribute values must be at most ${maxValueLength} characters`
        })
      ]
    }),
    {
      modifiers: [
        v.minLength(1, { message: 'Each attribute needs at least one value' }),
        v.maxLength(maxValuesPerKey, {
          message: `Each attribute can have at most ${maxValuesPerKey} values`
        })
      ]
    }
  )
);

export let eventAttributesValidator: ValidationType<EventAttributes> = {
  ...attributeValuesValidator,
  validate: value => {
    let result = attributeValuesValidator.validate(value);
    if (!result.success) return result;

    let keys = Object.keys(value as EventAttributes);
    if (keys.length > maxKeys) {
      return v.error([
        {
          code: 'invalid_max_length',
          message: `Events can have at most ${maxKeys} attributes`,
          max: maxKeys,
          received: keys.length
        }
      ]);
    }

    let invalidKey = keys.find(key => !keyPattern.test(key));
    if (invalidKey !== undefined) {
      return v.error([
        {
          code: 'invalid_regex',
          message: `Invalid attribute key "${invalidKey}": keys start with a letter and contain only letters, digits and underscores (at most 64 characters)`,
          path: [invalidKey],
          received: invalidKey
        }
      ]);
    }

    return result;
  }
};

export let flattenEventAttributes = (attributes: EventAttributes | null | undefined) => [
  ...new Set(
    Object.entries(attributes ?? {}).flatMap(([key, values]) =>
      values.map(value => `${key}:${value}`)
    )
  )
];

// Keys never contain a colon, so the first one separates the key from a value that may.
let splitEventAttribute = (entry: string): EventAttribute | null => {
  let separator = entry.indexOf(':');
  if (separator < 0) return null;

  return { key: entry.slice(0, separator), value: entry.slice(separator + 1) };
};

let groupEventAttributes = (attributes: EventAttribute[]): EventAttributes => {
  let grouped = new Map<string, string[]>();

  for (let { key, value } of attributes) {
    let values = grouped.get(key);
    if (values) values.push(value);
    else grouped.set(key, [value]);
  }

  return Object.fromEntries(grouped);
};

export let unflattenEventAttributes = (flat: string[]) =>
  groupEventAttributes(
    flat
      .map(splitEventAttribute)
      .filter((attribute): attribute is EventAttribute => !!attribute?.key)
  );

export let parseEventAttributeFilter = (entries: string[]) =>
  groupEventAttributes(
    entries.map(entry => {
      let attribute = splitEventAttribute(entry);

      if (
        !attribute ||
        !keyPattern.test(attribute.key) ||
        !attribute.value ||
        attribute.value.length > maxValueLength
      ) {
        throw new ServiceError(
          badRequestError({
            message: `Invalid attribute filter "${entry}": expected "key:value", where the key starts with a letter and contains only letters, digits and underscores, and the value is 1 to ${maxValueLength} characters`
          })
        );
      }

      return attribute;
    })
  );
