import type { CodegenConfig } from '@graphql-codegen/cli';

// Generates resolver types from schema.graphql so resolvers can't drift from the contract.
const config: CodegenConfig = {
  schema: './schema.graphql',
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        contextType: '../graphql/context.js#GraphQLContext',
        // Resolvers receive database rows as their parent, not the GraphQL shape.
        mappers: {
          Event: '../db/schema.js#EventRow',
          Venue: '../db/schema.js#VenueRow',
        },
        // GraphQL enums are UPPER_CASE; Postgres enums are lower_case. These maps let
        // resolvers return raw database values and Apollo translates them.
        enumValues: {
          EventStatus: {
            SCHEDULED: 'scheduled',
            ON_SALE: 'on_sale',
            SOLD_OUT: 'sold_out',
            CANCELLED: 'cancelled',
          },
          SeatStatus: { AVAILABLE: 'available', HELD: 'held', SOLD: 'sold' },
        },
        enumsAsTypes: true,
        scalars: { DateTime: 'Date' },
      },
    },
  },
};

export default config;
