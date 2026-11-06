import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

/**
 * Yard docs instance sidebars. Each context carries its 14-page ddd-crew pack.
 * The strategic pages are generated from yard/model/model.yaml.
 */
const CONTEXTS = ['dock-scheduling', 'yard-management'];

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
  'use-cases',
  'class-diagram',
  'entity-relationship',
  'sequence-diagrams',
];

const contextCategories = CONTEXTS.map((ctx) => ({
  type: 'category' as const,
  label: ctx,
  link: {type: 'doc' as const, id: `contexts/${ctx}/index`},
  items: CONTEXT_PAGES.map((p) => `contexts/${ctx}/${p}`),
}));

const sidebars: SidebarsConfig = {
  strategicSidebar: [
    'overview',
    'adr/index',
    {
      type: 'category',
      label: 'Strategic Design',
      link: {type: 'doc', id: 'strategic-design/index'},
      items: [
        'strategic-design/subdomain-classification',
        'strategic-design/context-map',
        'strategic-design/ubiquitous-language',
        'strategic-design/event-standard-cloudevents',
        'strategic-design/business-capability-map',
        'strategic-design/model-gap-register',
      ],
    },
    {
      type: 'category',
      label: 'Research',
      items: ['research/benchmarks'],
    },
  ],
  contextsSidebar: ['contexts/index', ...contextCategories],
};

export default sidebars;
