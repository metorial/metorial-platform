import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [/@lowerdeck\//, '@metorial-services/scout-client']
      }
    }
  }
});
