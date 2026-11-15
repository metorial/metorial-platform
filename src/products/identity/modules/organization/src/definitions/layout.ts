import { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';

export type OrganizationLayoutOwnership = 'user' | 'organization' | 'user_organization';

export type OrganizationLayoutDeclaration<
  Schema extends ValidationType<any> = ValidationType<any>
> = {
  identifier: string;
  name: string;
  ownership: OrganizationLayoutOwnership;
  schema: Schema;
  default: ValidationTypeValue<Schema>;
};

let declarations = new Map<string, OrganizationLayoutDeclaration>();

export let declareOrganizationLayout = <Schema extends ValidationType<any>>(
  declaration: OrganizationLayoutDeclaration<Schema>
) => {
  if (declarations.has(declaration.identifier)) {
    throw new Error(
      `Organization layout "${declaration.identifier}" has already been declared`
    );
  }

  let validation = declaration.schema.validate(declaration.default);
  if (!validation.success) {
    throw new Error(
      `Default value for organization layout "${declaration.identifier}" is invalid`
    );
  }

  let normalizedDeclaration = {
    ...declaration,
    default: validation.value
  };

  declarations.set(declaration.identifier, normalizedDeclaration);
  return normalizedDeclaration;
};

export let getOrganizationLayoutDeclarations = () => [...declarations.values()];

export let getOrganizationLayoutDeclaration = (identifier: string) =>
  declarations.get(identifier);
