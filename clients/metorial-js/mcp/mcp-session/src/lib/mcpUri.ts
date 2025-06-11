type TemplateValues = Record<string, string | string[]>;

export class McpUriTemplate {
  private segments: (string | { key: string; explode: boolean; optional: boolean })[];

  constructor(private template: string) {
    this.segments = this.parseTemplate(template);
  }

  private parseTemplate(template: string) {
    let pattern = /\{(\/)?([\w]+)(\*)?\}/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let parts: (string | { key: string; explode: boolean; optional: boolean })[] = [];

    while ((match = pattern.exec(template)) !== null) {
      let [fullMatch, leadingSlash, key, star] = match;
      if (match.index > lastIndex) {
        parts.push(template.slice(lastIndex, match.index));
      }

      parts.push({
        key,
        explode: !!star,
        optional: !!leadingSlash
      });

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < template.length) {
      parts.push(template.slice(lastIndex));
    }

    return parts;
  }

  getProperties() {
    return this.segments.filter(part => typeof part !== 'string').map(part => part);
  }

  getKeys() {
    return this.getProperties().map(part => part.key);
  }

  expand(values: TemplateValues) {
    return this.segments
      .map(segment => {
        if (typeof segment === 'string') return segment;

        let { key, explode, optional } = segment;
        let value = values[key];

        if (value === undefined || value === null) {
          if (optional) return '';
          throw new Error(`Missing value for required key: ${key}`);
        }

        if (Array.isArray(value)) {
          return (optional ? '/' : '') + value.map(encodeURIComponent).join('/');
        } else {
          return (optional ? '/' : '') + encodeURIComponent(value);
        }
      })
      .join('');
  }
}
