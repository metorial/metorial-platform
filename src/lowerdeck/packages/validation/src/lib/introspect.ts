import { ValidationType } from './types';

export interface IntrospectedType {
  examples: any[];
  items?: IntrospectedType[];
  properties?: Record<string, IntrospectedType>;
  type: string;
  name?: string;
  description?: string;
  optional: boolean;
  nullable: boolean;
}

export let introspectType = (type: ValidationType<any>): IntrospectedType => ({
  examples: type.examples ?? [],
  items: type.items
    ? Array.isArray(type.items)
      ? type.items.map(introspectType)
      : [introspectType(type.items)]
    : undefined,
  properties: type.properties
    ? Object.fromEntries(
        Object.entries(type.properties)
          .filter(([_, v]) => !v.hidden)
          .map(([key, value]) => [key, introspectType(value)])
      )
    : undefined,
  type: type.type,
  name: type.name,
  description: type.description,
  optional: !!type.optional,
  nullable: !!type.nullable
});
