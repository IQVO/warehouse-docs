import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

import orderManagementSidebar from './docs/api-reference/rest/order-management/sidebar';
import inventoryStorageSidebar from './docs/api-reference/rest/inventory-storage/sidebar';
import wesWorkPlanningSidebar from './docs/api-reference/rest/wes-work-planning/sidebar';
import fulfillmentExecutionSidebar from './docs/api-reference/rest/fulfillment-execution/sidebar';
import workforceManagementSidebar from './docs/api-reference/rest/workforce-management/sidebar';
import facilityLayoutSidebar from './docs/api-reference/rest/facility-layout/sidebar';
import processPathManagementSidebar from './docs/api-reference/rest/process-path-management/sidebar';
import laborPerformanceSidebar from './docs/api-reference/rest/labor-performance/sidebar';
import laborPerformanceReportsSidebar from './docs/api-reference/rest/labor-performance-reports/sidebar';
import networkFulfillmentSidebar from './docs/api-reference/rest/network-fulfillment/sidebar';
import warehousePlanningSidebar from './docs/api-reference/rest/warehouse-planning/sidebar';
import productMasterSidebar from './docs/api-reference/rest/product-master/sidebar';
import networkInventoryPlanningSidebar from './docs/api-reference/rest/network-inventory-planning/sidebar';

/**
 * Every bounded context's category lists the same page set, in the same
 * order: business context first, then the ddd-crew artifact pack synced from
 * the context repo (each page names the ddd-crew tool it applies), then the
 * Kafka narrative where the context has one.
 */
const CONTEXTS = [
  'order-management',
  'inventory-storage',
  'wes-work-planning',
  'fulfillment-execution',
  'workforce-management',
  'facility-layout',
  'process-path-management',
  'labor-performance',
  'warehouse-ops-agent',
  'network-fulfillment',
  'warehouse-planning',
  'product-master',
  'network-inventory-planning',
];

const CONTEXT_PAGES = [
  'business-context',
  'ubiquitous-language',
  'core-domain-chart',
  'bounded-context-canvas',
  'context-map',
  'aggregate-design-canvas',
  'domain-events',
  'domain-message-flow',
  'eventstorming',
  'class-diagram',
  'entity-relationship',
  'sequence-diagrams',
];

// Contexts with a hand-written contexts/<ctx>/async-api narrative page.
const ASYNC_NARRATIVE = new Set([
  'inventory-storage',
  'wes-work-planning',
  'fulfillment-execution',
  'workforce-management',
  'process-path-management',
  'labor-performance',
  'network-fulfillment',
  'warehouse-planning',
  'product-master',
  'network-inventory-planning',
]);

// Pages a context has beyond the shared page set, appended after it.
// product-master's own docs site keeps a use-case catalogue next to the pack.
const CONTEXT_EXTRA_PAGES: Record<string, string[]> = {
  'product-master': ['use-cases'],
};

function contextCategory(ctx: string, hasAsyncNarrative: boolean) {
  const base = [...CONTEXT_PAGES, ...(CONTEXT_EXTRA_PAGES[ctx] ?? [])];
  const pages = hasAsyncNarrative ? [...base, 'async-api'] : base;
  return {
    type: 'category' as const,
    label: ctx,
    link: {type: 'doc' as const, id: `contexts/${ctx}/index`},
    items: pages.map((page) => `contexts/${ctx}/${page}`),
  };
}

/**
 * Five independent sidebars, one per navbar item:
 *  - strategicSidebar:   ddd-crew strategic-design artifacts for the WHOLE fleet
 *  - architectureSidebar: C4 levels 1-3, domain/data models, runtime flows
 *  - contextsSidebar:    per-bounded-context tactical DDD + business + async docs
 *  - apiSidebar:         generated REST reference (docusaurus-plugin-openapi-docs)
 *  - (ADRs is a single top-level link, not a sidebar, see navbar)
 */
const sidebars: SidebarsConfig = {
  strategicSidebar: [
    'overview',
    {
      type: 'category',
      label: 'Strategic Design',
      link: {type: 'doc', id: 'strategic-design/index'},
      items: [
        'strategic-design/ddd-starter-modelling-process',
        'strategic-design/domain-vision',
        'strategic-design/core-domain-chart',
        'strategic-design/subdomain-classification',
        'strategic-design/eventstorming-big-picture',
        'strategic-design/context-map',
        'strategic-design/domain-message-flows',
        'strategic-design/event-standard-cloudevents',
        'strategic-design/audit-decisions-2026-10',
        'strategic-design/ubiquitous-language',
      ],
    },
    'glossary',
  ],

  architectureSidebar: [
    {
      type: 'category',
      label: 'Architecture',
      link: {type: 'doc', id: 'architecture/index'},
      items: [
        'architecture/diagram-notation',
        {
          type: 'category',
          label: 'C4 model',
          items: [
            'architecture/system-context',
            'architecture/containers',
            'architecture/components',
          ],
        },
        'architecture/domain-model',
        'architecture/data-models',
        'architecture/runtime-flows',
      ],
    },
  ],

  contextsSidebar: [
    'contexts/index',
    ...CONTEXTS.map((ctx) => contextCategory(ctx, ASYNC_NARRATIVE.has(ctx))),
  ],

  apiSidebar: [
    'api-reference/index',
    {
      type: 'category',
      label: 'order-management',
      items: [...orderManagementSidebar, 'api-reference/async/order-management'],
    },
    {
      type: 'category',
      label: 'inventory-storage',
      items: [...inventoryStorageSidebar, 'api-reference/async/inventory-storage'],
    },
    {
      type: 'category',
      label: 'wes-work-planning',
      items: [...wesWorkPlanningSidebar, 'api-reference/async/wes-work-planning'],
    },
    {
      type: 'category',
      label: 'fulfillment-execution',
      items: [...fulfillmentExecutionSidebar, 'api-reference/async/fulfillment-execution'],
    },
    {
      type: 'category',
      label: 'workforce-management',
      items: [...workforceManagementSidebar, 'api-reference/async/workforce-management'],
    },
    {
      type: 'category',
      label: 'facility-layout',
      items: [...facilityLayoutSidebar, 'api-reference/async/facility-layout'],
    },
    {
      type: 'category',
      label: 'process-path-management',
      items: [...processPathManagementSidebar, 'api-reference/async/process-path-management'],
    },
    {
      type: 'category',
      label: 'labor-performance',
      items: [
        ...laborPerformanceSidebar,
        ...laborPerformanceReportsSidebar,
        'api-reference/async/labor-performance',
      ],
    },
    {
      type: 'category',
      label: 'warehouse-ops-agent',
      items: ['api-reference/warehouse-ops-agent'],
    },
    {
      type: 'category',
      label: 'network-fulfillment',
      items: [...networkFulfillmentSidebar, 'api-reference/async/network-fulfillment'],
    },
    {
      type: 'category',
      label: 'warehouse-planning',
      items: [...warehousePlanningSidebar, 'api-reference/async/warehouse-planning'],
    },
    {
      type: 'category',
      label: 'product-master',
      items: [...productMasterSidebar, 'api-reference/async/product-master'],
    },
    {
      type: 'category',
      label: 'network-inventory-planning',
      items: [...networkInventoryPlanningSidebar, 'api-reference/async/network-inventory-planning'],
    },
  ],
};

export default sidebars;
