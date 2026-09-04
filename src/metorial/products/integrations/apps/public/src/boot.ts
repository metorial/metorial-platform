export {};

async function main() {
  await import('./endpoints');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
