import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express from 'express';
import { pool } from './db/client.js';
import { env } from './env.js';
import { createContext, type GraphQLContext } from './graphql/context.js';
import { resolvers } from './graphql/resolvers.js';
import { checkHealth } from './health.js';
import { redis } from './redis.js';

// schema.graphql sits at the package root, one level above both src/ and dist/.
const typeDefs = readFileSync(path.resolve(import.meta.dirname, '../schema.graphql'), 'utf8');

const app = express();
const httpServer = http.createServer(app);

const apollo = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  // Lets in-flight requests finish before the process exits.
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await apollo.start();

// Plain HTTP health check, the kind load balancers and uptime monitors call.
app.get('/health', async (_req, res) => {
  const status = await checkHealth();
  res.status(status.postgres ? 200 : 503).json(status);
});

app.use(
  '/graphql',
  cors({ origin: env.WEB_ORIGIN }),
  express.json(),
  expressMiddleware(apollo, { context: async () => createContext() }),
);

httpServer.listen(env.PORT, () => {
  console.log(`API ready at http://localhost:${env.PORT}/graphql`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  await apollo.stop();
  await Promise.allSettled([pool.end(), redis.quit()]);
  process.exit(0);
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
