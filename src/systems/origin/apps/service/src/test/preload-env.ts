if (process.env.ORIGIN_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.ORIGIN_DATABASE_URL;
}
