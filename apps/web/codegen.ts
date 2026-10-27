import type { CodegenConfig } from '@graphql-codegen/cli';

// Scans components for graphql(`...`) calls and generates a fully typed document for each.
const config: CodegenConfig = {
  schema: '../api/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        // Emit plain query strings instead of AST objects: smaller bundles, and a
        // perfect fit for a fetch-based client like the one in src/lib/graphql.ts.
        documentMode: 'string',
        useTypeImports: true,
        enumsAsTypes: true,
        scalars: { DateTime: 'string' },
      },
    },
  },
};

export default config;
