import {
  StrictMode,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { BrowserAuth } from './auth.ts';
import { createApiClient } from '@hyperbug/api-client';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  useLocation,
  RouterProvider,
} from '@tanstack/react-router';
import { instanceQuery } from './capabilities.ts';
import type { RuntimeConfig } from './runtime-config.ts';
import { validateIssueSearch } from './product-state.ts';
import { MinimumNotice } from './components/minimum-notice.tsx';

interface ApplicationContext {
  config: RuntimeConfig;
  instance: ReturnType<typeof instanceQuery>;
  auth: BrowserAuth;
  publicClient: ReturnType<typeof createApiClient>;
}

const rootRoute = createRootRouteWithContext<ApplicationContext>()({
  component: ApplicationShell,
  notFoundComponent: () => (
    <>
      <h1>Page not found</h1>
      <p>This address is not part of this instance.</p>
      <Link to="/">Return to overview</Link>
    </>
  ),
});
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('./routes/overview.tsx'),
    'Overview',
  ),
});
const instanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/instance',
  validateSearch: (
    search: Record<string, unknown>,
  ): { section: 'capabilities' | 'limits' } => ({
    section: search.section === 'limits' ? 'limits' : 'capabilities',
  }),
  component: lazyRouteComponent(
    () => import('./routes/instance.tsx'),
    'Instance',
  ),
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: lazyRouteComponent(
    () => import('./routes/account.tsx'),
    'Account',
  ),
});
export const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  validateSearch: validateIssueSearch,
  component: lazyRouteComponent(
    () => import('./routes/project.tsx'),
    'Project',
  ),
});
export const newIssueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/new',
  component: lazyRouteComponent(
    () => import('./routes/new-issue.tsx'),
    'NewIssue',
  ),
});
export const issueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/issues/$issueId/$number',
  validateSearch: (raw: Record<string, unknown>) => ({
    cursor:
      typeof raw.cursor === 'string' && raw.cursor.length <= 2048
        ? raw.cursor
        : '',
    comment:
      typeof raw.comment === 'string' && /^[0-9a-f-]{36}$/.test(raw.comment)
        ? raw.comment
        : '',
  }),
  component: lazyRouteComponent(() => import('./routes/issue.tsx'), 'Issue'),
});
export const manageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/manage',
  validateSearch: (raw: Record<string, unknown>) => ({
    auditAfter:
      typeof raw.auditAfter === 'string' && raw.auditAfter.length <= 1024
        ? raw.auditAfter
        : '',
  }),
  component: lazyRouteComponent(() => import('./routes/manage.tsx'), 'Manage'),
});
const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugins',
  component: lazyRouteComponent(
    () => import('./routes/plugins-admin.tsx'),
    'PluginsAdmin',
  ),
});

function makeRouter(context: ApplicationContext) {
  return createRouter({
    routeTree: rootRoute.addChildren([
      overviewRoute,
      instanceRoute,
      accountRoute,
      projectRoute,
      newIssueRoute,
      issueRoute,
      manageRoute,
      pluginsRoute,
    ]),
    context,
    defaultPreload: 'intent',
    defaultPendingComponent: () => <output>Loading page…</output>,
    defaultErrorComponent: () => (
      <>
        <h1>Page unavailable</h1>
        <p>Reload this page to try again.</p>
      </>
    ),
  });
}
export type ApplicationRouter = ReturnType<typeof makeRouter>;
declare module '@tanstack/react-router' {
  interface Register {
    router: ApplicationRouter;
  }
}

export function useInstance() {
  const { instance } = rootRoute.useRouteContext();
  return useQuery(instance);
}
export function usePublicConfig() {
  return rootRoute.useRouteContext().config;
}
export function usePublicClient() {
  return rootRoute.useRouteContext().publicClient;
}
export { instanceRoute };
export function useAuth() {
  const { auth } = rootRoute.useRouteContext();
  return {
    auth,
    state: useSyncExternalStore(auth.subscribe, auth.getSnapshot),
  };
}

function ApplicationShell() {
  const routePath = useLocation({ select: (current) => current.pathname });
  const config = usePublicConfig();
  const instance = useInstance();
  const { state } = useAuth();
  const previousEpoch = useRef(state.epoch);
  useLayoutEffect(() => {
    if (previousEpoch.current !== state.epoch)
      document.getElementById('content')?.focus();
    previousEpoch.current = state.epoch;
  }, [state.epoch]);
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          {config.applicationName}
        </Link>
        <nav aria-label="Primary">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ 'aria-current': 'page' }}
          >
            Overview
          </Link>
          <Link to="/account" activeProps={{ 'aria-current': 'page' }}>
            Account
          </Link>
          <Link
            to="/instance"
            search={{ section: 'capabilities' }}
            activeProps={{ 'aria-current': 'page' }}
          >
            Instance
          </Link>
        </nav>
      </header>
      <main id="content" tabIndex={-1}>
        {instance.isPending ? (
          <>
            <h1>Connecting to this instance</h1>
            <output>Checking available capabilities…</output>
          </>
        ) : instance.isError ? (
          <>
            <h1>This instance is unavailable</h1>
            <p role="alert">
              Its capabilities could not be verified. Try again or contact its
              administrator.
            </p>
            <button
              type="button"
              disabled={instance.isFetching}
              onClick={() => {
                void instance.refetch();
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            {routePath !== '/account' && state.notice ? (
              <output>{state.notice}</output>
            ) : null}
            <Outlet key={`${state.epoch}:${routePath}`} />
          </>
        )}
      </main>
      <footer className="site-footer">
        <MinimumNotice />
        <p>Powered by HyperBug · A shared place for feedback</p>
      </footer>
    </>
  );
}

export async function startApplication(
  container: HTMLElement,
  config: RuntimeConfig,
  callback: URLSearchParams | null,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth = new BrowserAuth(config, queryClient);
  if (callback) await auth.completeCallback(callback);
  const publicClient = createApiClient({
    baseUrl: config.apiBaseUrl,
    maxRetries: 0,
  });
  const router = makeRouter({
    config,
    instance: instanceQuery(config),
    auth,
    publicClient,
  });
  let previousPath = location.pathname;
  router.subscribe('onRendered', ({ toLocation }) => {
    const page =
      toLocation.pathname === '/account'
        ? 'Account'
        : toLocation.pathname === '/instance'
          ? 'Instance'
          : toLocation.pathname.startsWith('/projects/')
            ? 'Project'
            : 'Overview';
    document.title = `${page} · ${config.applicationName}`;
    if (previousPath !== toLocation.pathname)
      document.getElementById('content')?.focus();
    previousPath = toLocation.pathname;
  });
  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
