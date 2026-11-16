export interface SelectorElement {
  tagName: string;
  parentElement: SelectorElement | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}

type AttributeCondition = {
  name: string;
  operator: '=' | '~=' | null;
  value: string;
};

type CompoundSelector = {
  tag: string | null;
  attributes: AttributeCondition[];
  combinator: ' ' | '>';
};

let compoundPattern =
  /^(\*|[a-zA-Z][\w-]*)?((?:\.[\w-]+|\[\s*[\w-]+\s*(?:~?=\s*(?:"[^"]*"|'[^']*'|[^\]\s]+))?\s*\])*)$/;

let attributePattern =
  /\.([\w-]+)|\[\s*([\w-]+)\s*(?:(~?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]/g;

let asciiWhitespace = /[ \t\n\f\r]+/;

let parsedSelectors = new Map<string, CompoundSelector[][]>();

let parseCompound = (source: string, combinator: ' ' | '>'): CompoundSelector => {
  let match = compoundPattern.exec(source);
  if (!match) throw new Error(`Unsupported selector "${source}"`);

  let attributes: AttributeCondition[] = [];
  for (let part of (match[2] ?? '').matchAll(attributePattern)) {
    if (part[1]) {
      attributes.push({ name: 'class', operator: '~=', value: part[1] });
    } else {
      attributes.push({
        name: part[2]!,
        operator: (part[3] as '=' | '~=' | undefined) ?? null,
        value: part[4] ?? part[5] ?? part[6] ?? ''
      });
    }
  }

  let tag = match[1] && match[1] != '*' ? match[1].toLowerCase() : null;
  return { tag, attributes, combinator };
};

let splitTopLevel = (source: string, separator: string) => {
  let parts: string[] = [];
  let current = '';
  let bracket = false;
  let quote: string | null = null;

  for (let char of source) {
    if (quote) {
      if (char == quote) quote = null;
    } else if (bracket && (char == '"' || char == "'")) {
      quote = char;
    } else if (char == '[') {
      bracket = true;
    } else if (char == ']') {
      bracket = false;
    } else if (!bracket && char == separator) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
};

let parseComplex = (source: string): CompoundSelector[] => {
  let compounds: CompoundSelector[] = [];
  let current = '';
  let combinator: ' ' | '>' = ' ';
  let dangling = false;
  let bracket = false;
  let quote: string | null = null;

  let flush = () => {
    if (!current) return;

    compounds.push(parseCompound(current, combinator));
    current = '';
    combinator = ' ';
    dangling = false;
  };

  for (let char of source.trim()) {
    if (quote) {
      if (char == quote) quote = null;
    } else if (bracket && (char == '"' || char == "'")) {
      quote = char;
    } else if (char == '[') {
      bracket = true;
    } else if (char == ']') {
      bracket = false;
    } else if (!bracket && (char == ' ' || char == '>')) {
      flush();
      if (char == '>') {
        if (compounds.length == 0 || dangling) {
          throw new Error(`Unsupported selector "${source}"`);
        }
        combinator = '>';
        dangling = true;
      }
      continue;
    }

    current += char;
  }

  flush();
  if (dangling) throw new Error(`Unsupported selector "${source}"`);

  if (compounds.length == 0) throw new Error(`Unsupported selector "${source}"`);
  return compounds;
};

export let parseSelector = (selector: string) => {
  let cached = parsedSelectors.get(selector);
  if (cached) return cached;

  let parsed = splitTopLevel(selector, ',').map(parseComplex);
  parsedSelectors.set(selector, parsed);
  return parsed;
};

let matchesCompound = (element: SelectorElement, compound: CompoundSelector) => {
  if (compound.tag && element.tagName.toLowerCase() != compound.tag) return false;

  return compound.attributes.every(condition => {
    let value = element.getAttribute(condition.name);
    if (value === null) return false;
    if (condition.operator == '=') return value == condition.value;
    if (condition.operator == '~=')
      return value.split(asciiWhitespace).includes(condition.value);
    return true;
  });
};

let matchesComplex = (
  element: SelectorElement,
  compounds: CompoundSelector[],
  index: number
): boolean => {
  let compound = compounds[index]!;
  if (!matchesCompound(element, compound)) return false;
  if (index == 0) return true;

  let parent = element.parentElement;
  if (compound.combinator == '>') {
    return !!parent && matchesComplex(parent, compounds, index - 1);
  }

  for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
    if (matchesComplex(ancestor, compounds, index - 1)) return true;
  }

  return false;
};

export let elementMatches = (element: SelectorElement, selector: string) =>
  parseSelector(selector).some(compounds =>
    matchesComplex(element, compounds, compounds.length - 1)
  );
