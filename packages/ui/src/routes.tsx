import { createRootRoute, createRoute } from '@tanstack/react-router';
import { Layout } from './components/layout';
import { ComparePage } from './pages/compare';
import { ConfigPage } from './pages/config';
import { Dashboard } from './pages/dashboard';
import { FlakyPage } from './pages/flaky';
import { GalleryPage } from './pages/gallery';
import { RequirementsPage } from './pages/requirements';
import { TestDetailPage } from './pages/test-detail';
import { TestsPage } from './pages/tests';
import { TimelinePage } from './pages/timeline';
import { TrendsPage } from './pages/trends';

export interface TestsSearch {
  q?: string;
  /** Comma-separated outcome filter, e.g. "unexpected,flaky". */
  outcome?: string;
  project?: string;
  /** Comma-separated tag filter, e.g. "@smoke,@regression". */
  tag?: string;
  /** caseId previewed in the right-hand pane. */
  selected?: string;
  /** tree | file | suite | project | tag */
  group?: string;
  /** duration | name | status */
  sort?: string;
}

const rootRoute = createRootRoute({ component: Layout });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const testsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tests',
  component: TestsPage,
  // Filters live in the URL so any filtered view is a shareable deep link.
  // All optional: plain links to /tests need no search object.
  validateSearch: (search: Record<string, unknown>): TestsSearch => {
    const out: TestsSearch = {};
    if (typeof search.q === 'string' && search.q) out.q = search.q;
    if (typeof search.outcome === 'string' && search.outcome) out.outcome = search.outcome;
    if (typeof search.project === 'string' && search.project) out.project = search.project;
    if (typeof search.tag === 'string' && search.tag) out.tag = search.tag;
    if (typeof search.selected === 'string' && search.selected) out.selected = search.selected;
    if (typeof search.group === 'string' && search.group) out.group = search.group;
    if (typeof search.sort === 'string' && search.sort) out.sort = search.sort;
    return out;
  },
});

const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timeline',
  component: TimelinePage,
});

export interface GallerySearch {
  q?: string;
  outcome?: string;
  project?: string;
}

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryPage,
  validateSearch: (search: Record<string, unknown>): GallerySearch => {
    const out: GallerySearch = {};
    if (typeof search.q === 'string' && search.q) out.q = search.q;
    if (typeof search.outcome === 'string' && search.outcome) out.outcome = search.outcome;
    if (typeof search.project === 'string' && search.project) out.project = search.project;
    return out;
  },
});

const testDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tests/$caseId',
  component: TestDetailPage,
});

export interface CompareSearch {
  /** Baseline runId; defaults to the most recent baseline. */
  base?: string;
}

const compareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compare',
  component: ComparePage,
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const out: CompareSearch = {};
    if (typeof search.base === 'string' && search.base) out.base = search.base;
    return out;
  },
});

const flakyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/flaky',
  component: FlakyPage,
});

const configRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config',
  component: ConfigPage,
});

const trendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trends',
  component: TrendsPage,
});

const requirementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requirements',
  component: RequirementsPage,
});

export const routeTree = rootRoute.addChildren([
  dashboardRoute,
  testsRoute,
  testDetailRoute,
  timelineRoute,
  galleryRoute,
  compareRoute,
  flakyRoute,
  configRoute,
  trendsRoute,
  requirementsRoute,
]);
