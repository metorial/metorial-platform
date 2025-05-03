import styledComponentsPlugin from 'esbuild-plugin-styled-components';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
  esbuildPlugins: [styledComponentsPlugin({})],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client"'
    };
  }
});
