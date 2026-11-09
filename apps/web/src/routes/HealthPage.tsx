import { useQuery } from '@tanstack/react-query';
import { graphql } from '../gql';
import { execute } from '../lib/graphql';

/*
 * A placeholder page that proves the stack works end to end:
 * React -> TanStack Query -> typed GraphQL document -> Vite proxy -> Apollo -> Postgres + Redis.
 * Replace it with the event list in milestone 4.
 */
const HealthQuery = graphql(`
  query Health {
    health {
      postgres
      redis
    }
  }
`);

export function HealthPage() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => execute(HealthQuery),
    refetchInterval: 5_000,
  });

  const services = [
    { name: 'API', ok: !error && !isPending },
    { name: 'Postgres', ok: data?.health.postgres ?? false },
    { name: 'Redis', ok: data?.health.redis ?? false },
  ];

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Usher</h1>
      <p className="mt-2 text-gray-600">The skeleton is running. Next step: BUILD_PLAN.md, milestone 1.</p>

      <ul className="mt-8 divide-y divide-gray-200 rounded-lg border border-gray-200">
        {services.map((service) => (
          <li key={service.name} className="flex items-center justify-between px-4 py-3">
            <span>{service.name}</span>
            <span className={service.ok ? 'text-green-700' : 'text-red-700'}>
              {isPending ? 'Checking…' : service.ok ? 'Connected' : 'Not reachable'}
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-red-700">{error.message}</p>}
    </main>
  );
}
