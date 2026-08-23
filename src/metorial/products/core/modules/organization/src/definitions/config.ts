import { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';

export type OrganizationConfigOwnership = 'user' | 'organization' | 'user_organization';

export type OrganizationConfigDeclaration<
  Schema extends ValidationType<any> = ValidationType<any>
> = {
  identifier: string;
  name: string;
  ownership: OrganizationConfigOwnership;
  schema: Schema;
  default: ValidationTypeValue<Schema>;
};

let declarations = new Map<string, OrganizationConfigDeclaration>();

export let declareOrganizationConfig = <Schema extends ValidationType<any>>(
  declaration: OrganizationConfigDeclaration<Schema>
) => {
  if (declarations.has(declaration.identifier)) {
    throw new Error(
      `Organization config "${declaration.identifier}" has already been declared`
    );
  }

  let validation = declaration.schema.validate(declaration.default);
  if (!validation.success) {
    throw new Error(
      `Default value for organization config "${declaration.identifier}" is invalid`
    );
  }

  let normalizedDeclaration = {
    ...declaration,
    default: validation.value
  };

  declarations.set(declaration.identifier, normalizedDeclaration);
  return normalizedDeclaration;
};

export let getOrganizationConfigDeclarations = () => [...declarations.values()];

export let getOrganizationConfigDeclaration = (identifier: string) =>
  declarations.get(identifier);
