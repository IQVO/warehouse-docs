import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

import orderManagementSidebar from './docs/api-reference/rest/order-management/sidebar';
import orderManagementReportsSidebar from './docs/api-reference/rest/order-management-reports/sidebar';
import inventoryStorageSidebar from './docs/api-reference/rest/inventory-storage/sidebar';
import wesWorkPlanningSidebar from './docs/api-reference/rest/wes-work-planning/sidebar';
import wesWorkPlanningReportsSidebar from './docs/api-reference/rest/wes-work-planning-reports/sidebar';
import fulfillmentExecutionSidebar from './docs/api-reference/rest/fulfillment-execution/sidebar';
import fulfillmentExecutionReportsSidebar from './docs/api-reference/rest/fulfillment-execution-reports/sidebar';
import workforceManagementSidebar from './docs/api-reference/rest/workforce-management/sidebar';
import workforceManagementReportsSidebar from './docs/api-reference/rest/workforce-management-reports/sidebar';
import facilityLayoutSidebar from './docs/api-reference/rest/facility-layout/sidebar';
import facilityLayoutReportsSidebar from './docs/api-reference/rest/facility-layout-reports/sidebar';
import processPathManagementSidebar from './docs/api-reference/rest/process-path-management/sidebar';
import processPathManagementReportsSidebar from './docs/api-reference/rest/process-path-management-reports/sidebar';
import laborPerformanceSidebar from './docs/api-reference/rest/labor-performance/sidebar';
import laborPerformanceReportsSidebar from './docs/api-reference/rest/labor-performance-reports/sidebar';
import networkFulfillmentSidebar from './docs/api-reference/rest/network-fulfillment/sidebar';
import warehousePlanningSidebar from './docs/api-reference/rest/warehouse-planning/sidebar';
import productMasterSidebar from './docs/api-reference/rest/product-master/sidebar';
import inboundReceivingSidebar from './docs/api-reference/rest/inbound-receiving/sidebar';
import slottingOptimizationSidebar from './docs/api-reference/rest/slotting-optimization/sidebar';
import pickFaceReplenishmentSidebar from './docs/api-reference/rest/pick-face-replenishment/sidebar';
import taskInterleavingSidebar from './docs/api-reference/rest/task-interleaving/sidebar';
import networkInventoryPlanningSidebar from './docs/api-reference/rest/network-inventory-planning/sidebar';
import returnsProcessingSidebar from './docs/api-reference/rest/returns-processing/sidebar';
import exceptionManagementSidebar from './docs/api-reference/rest/exception-management/sidebar';

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
  'inbound-receiving',
  'slotting-optimization',
  'network-inventory-planning',
  'pick-face-replenishment',
  'task-interleaving',
  'returns-processing',
  'exception-management',
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
  'use-cases',
];

// Operational pages every context repository ships since the 2026-10 docs
// coverage campaign (operations/{configuration,runbook,observability,
// troubleshooting}.md and development/testing.md), synced like the pack and
// grouped in an "Operations" sub-category after it.
const CONTEXT_OPS_PAGES = [
  'configuration',
  'runbook',
  'observability',
  'troubleshooting',
  'testing',
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
  'inbound-receiving',
  'slotting-optimization',
  'network-inventory-planning',
  'pick-face-replenishment',
  'task-interleaving',
  'returns-processing',
  'exception-management',
]);

// Pages a context has beyond the shared page set, appended after it.
// Empty today: every context now ships the same synced set (pack, use cases
// and the operational pages).
const CONTEXT_EXTRA_PAGES: Record<string, string[]> = {};

// Contexts whose repository ships only part of the synced page set: they list
// exactly the pages that exist instead of the shared set. Remove an entry once
// the context's repository ships the full pack.
const CONTEXT_PAGE_OVERRIDES: Record<string, string[]> = {};


function contextCategory(ctx: string, hasAsyncNarrative: boolean) {
  const base = CONTEXT_PAGE_OVERRIDES[ctx] ?? [...CONTEXT_PAGES, ...(CONTEXT_EXTRA_PAGES[ctx] ?? [])];
  const pages = hasAsyncNarrative ? [...base, 'async-api'] : base;
  const ops = CONTEXT_PAGE_OVERRIDES[ctx] ? [] : CONTEXT_OPS_PAGES;
  return {
    type: 'category' as const,
    label: ctx,
    link: {type: 'doc' as const, id: `contexts/${ctx}/index`},
    items: [
      ...pages.map((page) => `contexts/${ctx}/${page}`),
      ...(ops.length
        ? [{
            type: 'category' as const,
            label: 'Operations',
            collapsed: true,
            items: ops.map((page) => `contexts/${ctx}/${page}`),
          }]
        : []),
    ],
  };
}

/**
 * Seven independent sidebars, one per navbar item:
 *  - strategicSidebar:   ddd-crew strategic-design artifacts for the WHOLE fleet
 *  - wmsWesSidebar:      the industry WMS/WES/WCS reference and the
 *                        qualification of every bounded context against it
 *  - capabilitySidebar:  business capability architecture (L1/L2/L3 map,
 *                        catalogue, heat maps, cross-mapping; four pages are
 *                        generated by scripts/capability-map/generate.py)
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
    {
      type: 'category',
      label: 'Fleet health',
      items: ['fleet-health/docs-coverage', 'fleet-health/ecosystem-gaps'],
    },
    {
      type: 'category',
      label: 'Fleet operations',
      items: [
        'fleet-operations/incident-runbook',
        'fleet-operations/slos',
        'fleet-operations/alert-catalogue',
      ],
    },
    'glossary',
  ],

  wmsWesSidebar: [
    {
      type: 'category',
      label: 'WMS and WES',
      link: {type: 'doc', id: 'wms-wes/index'},
      collapsed: false,
      items: [
        'wms-wes/industry-reference',
        'wms-wes/qualification',
        'wms-wes/wms-tier',
        'wms-wes/wes-tier',
        'wms-wes/tier-interactions',
      ],
    },
  ],

  capabilitySidebar: [
    {
      type: 'category',
      label: 'Business Capability Architecture',
      link: {type: 'doc', id: 'business-capability-architecture/index'},
      collapsed: false,
      items: [
        'business-capability-architecture/capability-map',
        'business-capability-architecture/capability-catalogue',
        'business-capability-architecture/heat-maps',
        'business-capability-architecture/cross-mapping',
      ],
    },
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
        'architecture/a2a-agents',
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
      items: [...orderManagementSidebar, ...orderManagementReportsSidebar, 'api-reference/async/order-management'],
    },
    {
      type: 'category',
      label: 'inventory-storage',
      items: [...inventoryStorageSidebar, 'api-reference/async/inventory-storage'],
    },
    {
      type: 'category',
      label: 'wes-work-planning',
      items: [...wesWorkPlanningSidebar, ...wesWorkPlanningReportsSidebar, 'api-reference/async/wes-work-planning'],
    },
    {
      type: 'category',
      label: 'fulfillment-execution',
      items: [...fulfillmentExecutionSidebar, ...fulfillmentExecutionReportsSidebar, 'api-reference/async/fulfillment-execution'],
    },
    {
      type: 'category',
      label: 'workforce-management',
      items: [...workforceManagementSidebar, ...workforceManagementReportsSidebar, 'api-reference/async/workforce-management'],
    },
    {
      type: 'category',
      label: 'facility-layout',
      items: [...facilityLayoutSidebar, ...facilityLayoutReportsSidebar, 'api-reference/async/facility-layout'],
    },
    {
      type: 'category',
      label: 'process-path-management',
      items: [...processPathManagementSidebar, ...processPathManagementReportsSidebar, 'api-reference/async/process-path-management'],
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
      label: 'inbound-receiving',
      items: [...inboundReceivingSidebar, 'api-reference/async/inbound-receiving'],
    },
    {
      type: 'category',
      label: 'slotting-optimization',
      items: [...slottingOptimizationSidebar, 'api-reference/async/slotting-optimization'],
    },
    {
      type: 'category',
      label: 'network-inventory-planning',
      items: [...networkInventoryPlanningSidebar, 'api-reference/async/network-inventory-planning'],
    },
    {
      type: 'category',
      label: 'pick-face-replenishment',
      items: [...pickFaceReplenishmentSidebar, 'api-reference/async/pick-face-replenishment'],
    },
    {
      type: 'category',
      label: 'task-interleaving',
      items: [...taskInterleavingSidebar, 'api-reference/async/task-interleaving'],
    },
    {
      type: 'category',
      label: 'returns-processing',
      items: [...returnsProcessingSidebar, 'api-reference/async/returns-processing'],
    },
    {
      type: 'category',
      label: 'exception-management',
      items: [...exceptionManagementSidebar, 'api-reference/async/exception-management'],
    },
  ],
};

export default sidebars;
