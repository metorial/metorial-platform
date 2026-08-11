export {};

async function main() {
  await import('./endpoints');
  await import('./connection/server');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
