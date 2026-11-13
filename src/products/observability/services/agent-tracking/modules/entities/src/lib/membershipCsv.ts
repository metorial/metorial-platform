import { normalizeEmail } from './normalize';

let maxRows = 20000;

let emailPattern = /^[^\s@]+@[^\s@]+$/;

export type MembershipCsvRow = { line: number; team: string; email: string; weight?: number };

export type MembershipCsvError = { line: number; message: string };

export type DesiredMember = { email: string; weight?: number };

export type CurrentMember = {
  email: string | null;
  userId: string | null;
  weight: number | null;
};

export type MembershipDiff = {
  added: DesiredMember[];
  removed: CurrentMember[];
  kept: DesiredMember[];
  changed: DesiredMember[];
};

let splitCsvLine = (line: string) => {
  let cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    let char = line[i]!;

    if (quoted) {
      if (char == '"' && line[i + 1] == '"') {
        cell += '"';
        i++;
      } else if (char == '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char == '"') {
      quoted = true;
    } else if (char == ',' || char == ';' || char == '\t') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);

  return cells.map(value => value.trim());
};

let isHeader = (cells: string[]) =>
  cells[0]?.toLowerCase() == 'team' || (!!cells[1] && !emailPattern.test(cells[1]));

export let parseMembershipCsv = (csv: string) => {
  let rows: MembershipCsvRow[] = [];
  let errors: MembershipCsvError[] = [];

  let lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);

  lines.forEach((raw, index) => {
    let line = index + 1;
    if (!raw.trim() || raw.trim().startsWith('#')) return;

    let cells = splitCsvLine(raw);
    if (!rows.length && !errors.length && isHeader(cells)) return;

    let [team, email, weight] = cells;

    if (!team) return errors.push({ line, message: 'Missing team.' });
    if (!email || !emailPattern.test(email)) {
      return errors.push({ line, message: `Invalid member email "${email ?? ''}".` });
    }

    let row: MembershipCsvRow = { line, team, email: normalizeEmail(email) };

    if (weight) {
      let parsed = Number(weight);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        return errors.push({ line, message: `Invalid weight "${weight}", expected 0 to 1.` });
      }

      row.weight = parsed;
    }

    if (rows.length >= maxRows) {
      return errors.push({ line, message: `Too many rows, at most ${maxRows} are allowed.` });
    }

    rows.push(row);
  });

  return { rows, errors };
};

export let groupRowsByTeam = (rows: MembershipCsvRow[]) => {
  let groups = new Map<string, Map<string, DesiredMember>>();

  for (let row of rows) {
    let members = groups.get(row.team) ?? new Map<string, DesiredMember>();
    members.set(row.email, { email: row.email, weight: row.weight });
    groups.set(row.team, members);
  }

  return new Map([...groups].map(([team, members]) => [team, [...members.values()]]));
};

export let diffMembers = (d: { current: CurrentMember[]; desired: DesiredMember[] }) => {
  let currentByEmail = new Map(
    d.current.filter(member => member.email).map(member => [member.email!, member])
  );
  let desiredEmails = new Set(d.desired.map(member => member.email));

  let diff: MembershipDiff = { added: [], removed: [], kept: [], changed: [] };

  for (let member of d.desired) {
    let current = currentByEmail.get(member.email);

    if (!current) diff.added.push(member);
    else if ((current.weight ?? undefined) != member.weight) diff.changed.push(member);
    else diff.kept.push(member);
  }

  diff.removed = d.current.filter(member => !member.email || !desiredEmails.has(member.email));

  return diff;
};
