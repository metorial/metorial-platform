import { readdir } from 'fs/promises';
import path from 'path';
import { Hono } from 'hono';

let publicDir = path.join(process.cwd(), 'frontend', 'public');

let files = await readdir(publicDir).catch(() => [] as string[]);

let cache = new Map<string, { buffer: ArrayBuffer; type: string }>();

for (let file of files) {
  let bunFile = Bun.file(path.join(publicDir, file));
  if (await bunFile.exists()) {
    cache.set(file, {
      buffer: await bunFile.arrayBuffer(),
      type: bunFile.type || 'application/octet-stream'
    });
  }
}

export let registerPublicFiles = (app: Hono) => {
  for (let [file, { buffer, type }] of cache) {
    app.get(`/${file}`, c =>
      c.body(buffer, {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'public, max-age=86400'
        }
      })
    );
  }
};
