process.env.CARGO_API_PORT ??= '52150';
process.env.CARGO_CONTENT_PORT ??= '52151';
process.env.CARGO_HEALTH_PORT ??= '12121';
process.env.REDIS_URL ??= 'redis://localhost:56379/0';
process.env.VOYAGER_URL ??= 'http://voyager.test/metorial-voyager';
process.env.OBJECT_STORAGE_URL ??= 'http://object-storage.test';
process.env.FILES_BUCKET_NAME ??= 'cargo-files-test';
process.env.DOWNLOAD_PUBLIC_URL ??= 'http://cargo-content.test';
process.env.API_URL ??= 'http://cargo-api.test';
process.env.CARGO_REGION ??= 'tst';
process.env.SIGNED_DOWNLOAD_URL_TOKEN_SECRET ??= 'cargo-download-test-secret';
process.env.ORIGIN_URL ??= 'http://origin.test/metorial-origin';
process.env.CODE_BUCKET_SERVICE_URL ??= 'code-bucket:5050';

if (process.env.CARGO_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.CARGO_DATABASE_URL;
}
