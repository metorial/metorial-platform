import { badRequestError, ServiceError } from '@lowerdeck/error';
import { type ValidationType, v } from '@lowerdeck/validation';

let maxKeys = 8;
let maxValuesPerKey = 16;
let maxValueLength = 256;
let keyPattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export type EventAttributes = Record<string, string[]>;

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

    let keys = Object.keys(result.value);
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
export let unflattenEventAttributes = (flat: string[]) => {
  let attributes: EventAttributes = {};

  for (let entry of flat) {
    let separator = entry.indexOf(':');
    if (separator < 1) continue;

    let key = entry.slice(0, separator);
    (attributes[key] ??= []).push(entry.slice(separator + 1));
  }

  return attributes;
};

export let parseEventAttributeFilter = (entries: string[]) => {
  let filter: EventAttributes = {};

  for (let entry of entries) {
    let separator = entry.indexOf(':');
    let key = separator < 0 ? entry : entry.slice(0, separator);
    let value = separator < 0 ? '' : entry.slice(separator + 1);

    if (separator < 0 || !keyPattern.test(key) || !value || value.length > maxValueLength) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid attribute filter "${entry}": expected "key:value", where the key starts with a letter and contains only letters, digits and underscores, and the value is 1 to ${maxValueLength} characters`
        })
      );
    }

    (filter[key] ??= []).push(value);
  }

  return filter;
};
