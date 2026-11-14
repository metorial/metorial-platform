import type { EvidenceLedger } from './ledger';

export type SectionValidationResult<T> = { value?: T; errors: string[] };

export type ReportValidationContext = {
  ledger: EvidenceLedger;
};

export type ReportSectionDefinition<T> = {
  description: string;
  shape: string;
  validate: (value: unknown, ctx: ReportValidationContext) => SectionValidationResult<T>;
};

export type ReportDefinition<R extends Record<string, any>> = {
  sections: { [K in keyof R]-?: ReportSectionDefinition<NonNullable<R[K]>> };
  validateReport: (report: Partial<R>, ctx: ReportValidationContext) => string[];
};

export let defineReport = <R extends Record<string, any>>(definition: ReportDefinition<R>) =>
  definition;

export let describeReport = (definition: ReportDefinition<any>) =>
  Object.entries(definition.sections)
    .map(
      ([name, section]) =>
        `### ${name}\n${section.description}\n\n\`\`\`ts\n${section.shape}\n\`\`\``
    )
    .join('\n\n');

export class ReportDraft<R extends Record<string, any>> {
  private values: Partial<R> = {};

  constructor(
    private definition: ReportDefinition<R>,
    initial?: Partial<R>
  ) {
    if (initial) this.values = { ...initial };
  }

  get sectionNames() {
    return Object.keys(this.definition.sections) as (keyof R & string)[];
  }

  get current() {
    return this.values;
  }

  writeSection(name: string, value: unknown, ctx: ReportValidationContext) {
    let section = this.definition.sections[name as keyof R];
    if (!section) {
      return {
        errors: [`Unknown section "${name}". Valid sections: ${this.sectionNames.join(', ')}`]
      };
    }

    let result = section.validate(value, ctx);
    if (result.errors.length || result.value === undefined) {
      return { errors: result.errors.length ? result.errors : ['Section is empty'] };
    }

    this.values = { ...this.values, [name]: result.value };
    return { errors: [] as string[], value: result.value };
  }

  validate(ctx: ReportValidationContext) {
    let errors: string[] = [];

    for (let name of this.sectionNames) {
      let value = this.values[name];
      if (value === undefined) continue;

      let result = this.definition.sections[name].validate(value, ctx);
      errors.push(...result.errors.map(error => `${name}: ${error}`));
    }

    errors.push(...this.definition.validateReport(this.values, ctx));
    return errors;
  }
}
