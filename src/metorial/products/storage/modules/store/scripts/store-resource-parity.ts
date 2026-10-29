import { parseArgs } from 'node:util';
import { SQL } from 'bun';
import { formatParityReport, runStoreResourceParity } from '../src/parity';

let usage = `Compares legacy and v2 store resource data (participants and access grants).

Read only: the checks run in a single REPEATABLE READ READ ONLY transaction.

Usage:
  bun run parity -- --url postgres://user:pass@host:5432/db [options]

Options:
  --url <url>        Database url (or set PARITY_DATABASE_URL)
  --project <oid>    Only check one project (by oid)
  --since <iso>      Count differences created at or after this time as "recent"
  --check <ids>      Comma separated check ids (default: all)
  --samples <n>      Sample differences per check (default: 10)
  --timeout-ms <n>   Statement timeout per query (default: 300000)
  --json             Print the report as JSON
  --help             Show this help
`;

let { values } = parseArgs({
  options: {
    url: { type: 'string' },
    project: { type: 'string' },
    since: { type: 'string' },
    check: { type: 'string' },
    samples: { type: 'string' },
    'timeout-ms': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' }
  }
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

let url = values.url ?? process.env.PARITY_DATABASE_URL;
if (!url) {
  console.error(usage);
  process.exit(2);
}

let since = values.since ? new Date(values.since) : undefined;
if (since && Number.isNaN(since.getTime())) {
  console.error(`Invalid --since: ${values.since}`);
  process.exit(2);
}

let timeoutMs = Number(values['timeout-ms'] ?? 300000);
let readOnlyStatement = /^\s*(with|select)\b/i;

let sql = new SQL(url, {
  max: 1,
  connectionTimeout: 30,
  connection: {
    application_name: 'store-resource-parity',
    default_transaction_read_only: 'on',
    statement_timeout: String(timeoutMs)
  }
});

try {
  let report = await sql.begin('isolation level repeatable read read only', async tx => {
    let query = async (text: string) => {
      if (!readOnlyStatement.test(text)) {
        throw new Error('The parity script only runs SELECT statements.');
      }

      return (await tx.savepoint(async savepoint => await savepoint.unsafe(text))) as Record<
        string,
        unknown
      >[];
    };

    let [session] = await query(
      `SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only, pg_is_in_recovery() AS replica`
    );
    if (!values.json) {
      console.error(
        `Connected to ${session?.database} (read only: ${session?.read_only}, replica: ${session?.replica})`
      );
    }
    if (session?.read_only !== 'on')
      throw new Error('Refusing to run: transaction is not read only.');

    return await runStoreResourceParity(query, {
      projectOid: values.project,
      since,
      sampleSize: values.samples ? Number(values.samples) : undefined,
      checkIds: values.check ? values.check.split(',').map(item => item.trim()) : undefined
    });
  });

  console.log(values.json ? JSON.stringify(report, null, 2) : formatParityReport(report));

  let failed =
    report.checks.some(check => check.error) ||
    Object.values(report.readiness).some(item => !item.ready);
  process.exitCode = failed ? 1 : 0;
} finally {
  await sql.close();
}
