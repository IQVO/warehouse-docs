import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';

const config: Config = {
  title: 'IQVO ecosystem documentation',
  tagline:
    'The single reference for every bounded context in the warehouse-systems ecosystem — strategic & tactical DDD artifacts, REST and async APIs, and business context.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
    faster: true,
  },

  url: 'https://iqvo.github.io',
  baseUrl: '/warehouse-docs/',

  organizationName: 'IQVO',
  projectName: 'warehouse-docs',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/IQVO/warehouse-docs/tree/main/',
          docItemComponent: '@theme/ApiItem',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          orderManagement: {
            specPath: 'apis/order-management/openapi.yaml',
            outputDir: 'docs/api-reference/rest/order-management',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          orderManagementReports: {
            specPath: 'apis/order-management/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/order-management-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          inventoryStorage: {
            specPath: 'apis/inventory-storage/openapi.yaml',
            outputDir: 'docs/api-reference/rest/inventory-storage',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          wesWorkPlanning: {
            specPath: 'apis/wes-work-planning/openapi.yaml',
            outputDir: 'docs/api-reference/rest/wes-work-planning',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          wesWorkPlanningReports: {
            specPath: 'apis/wes-work-planning/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/wes-work-planning-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          fulfillmentExecution: {
            specPath: 'apis/fulfillment-execution/openapi.yaml',
            outputDir: 'docs/api-reference/rest/fulfillment-execution',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          fulfillmentExecutionReports: {
            specPath: 'apis/fulfillment-execution/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/fulfillment-execution-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          workforceManagement: {
            specPath: 'apis/workforce-management/openapi.yaml',
            outputDir: 'docs/api-reference/rest/workforce-management',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          workforceManagementReports: {
            specPath: 'apis/workforce-management/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/workforce-management-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          facilityLayout: {
            specPath: 'apis/facility-layout/openapi.yaml',
            outputDir: 'docs/api-reference/rest/facility-layout',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          facilityLayoutReports: {
            specPath: 'apis/facility-layout/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/facility-layout-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          processPathManagement: {
            specPath: 'apis/process-path-management/openapi.yaml',
            outputDir: 'docs/api-reference/rest/process-path-management',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          processPathManagementReports: {
            specPath: 'apis/process-path-management/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/process-path-management-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          laborPerformance: {
            specPath: 'apis/labor-performance/openapi.yaml',
            outputDir: 'docs/api-reference/rest/labor-performance',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          laborPerformanceReports: {
            specPath: 'apis/labor-performance/openapi-reports.yaml',
            outputDir: 'docs/api-reference/rest/labor-performance-reports',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          networkFulfillment: {
            specPath: 'apis/network-fulfillment/openapi.yaml',
            outputDir: 'docs/api-reference/rest/network-fulfillment',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          warehousePlanning: {
            specPath: 'apis/warehouse-planning/openapi.yaml',
            outputDir: 'docs/api-reference/rest/warehouse-planning',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          productMaster: {
            specPath: 'apis/product-master/openapi.yaml',
            outputDir: 'docs/api-reference/rest/product-master',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          networkInventoryPlanning: {
            specPath: 'apis/network-inventory-planning/openapi.yaml',
            outputDir: 'docs/api-reference/rest/network-inventory-planning',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          inboundReceiving: {
            specPath: 'apis/inbound-receiving/openapi.yaml',
            outputDir: 'docs/api-reference/rest/inbound-receiving',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          slottingOptimization: {
            specPath: 'apis/slotting-optimization/openapi.yaml',
            outputDir: 'docs/api-reference/rest/slotting-optimization',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          pickFaceReplenishment: {
            specPath: 'apis/pick-face-replenishment/openapi.yaml',
            outputDir: 'docs/api-reference/rest/pick-face-replenishment',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          taskInterleaving: {
            specPath: 'apis/task-interleaving/openapi.yaml',
            outputDir: 'docs/api-reference/rest/task-interleaving',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
        } satisfies Record<string, OpenApiPlugin.Options>,
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'network',
        path: 'network/docs',
        routeBasePath: 'network',
        sidebarPath: './network-sidebars.ts',
        editUrl: 'https://github.com/IQVO/warehouse-docs/tree/main/',
        docItemComponent: '@theme/ApiItem',
      },
    ],
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'network-api',
        docsPluginId: 'network',
        config: {
          nodeTopology: {
            specPath: 'network/apis/node-topology/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/node-topology',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          offerAvailability: {
            specPath: 'network/apis/offer-availability/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/offer-availability',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          deliveryPromise: {
            specPath: 'network/apis/delivery-promise/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/delivery-promise',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          customerOrdering: {
            specPath: 'network/apis/customer-ordering/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/customer-ordering',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          orderSourcing: {
            specPath: 'network/apis/order-sourcing/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/order-sourcing',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          vendorConnectivity: {
            specPath: 'network/apis/vendor-connectivity/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/vendor-connectivity',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          linehaulTransportation: {
            specPath: 'network/apis/linehaul-transportation/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/linehaul-transportation',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          lastMileDelivery: {
            specPath: 'network/apis/last-mile-delivery/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/last-mile-delivery',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          shippingAndTracking: {
            specPath: 'network/apis/shipping-and-tracking/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/shipping-and-tracking',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          nodePerformance: {
            specPath: 'network/apis/node-performance/openapi.yaml',
            outputDir: 'network/docs/api-reference/rest/node-performance',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
        } satisfies Record<string, OpenApiPlugin.Options>,
      },
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs', '@docusaurus/theme-mermaid'],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'IQVO Ecosystem Docs',
      logo: {
        alt: 'warehouse-systems',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'strategicSidebar',
          position: 'left',
          label: 'Strategic Design',
        },
        {
          type: 'docSidebar',
          sidebarId: 'wmsWesSidebar',
          position: 'left',
          label: 'WMS & WES',
        },
        {
          type: 'docSidebar',
          sidebarId: 'capabilitySidebar',
          position: 'left',
          label: 'Business Capabilities',
        },
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: 'Architecture',
        },
        {
          type: 'docSidebar',
          sidebarId: 'contextsSidebar',
          position: 'left',
          label: 'Bounded Contexts',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API Reference',
        },
        {
          to: '/adr',
          label: 'ADRs',
          position: 'left',
        },
        {
          type: 'dropdown',
          label: 'Retail Network',
          position: 'left',
          items: [
            {type: 'docSidebar', sidebarId: 'researchSidebar', docsPluginId: 'network', label: 'Research'},
            {type: 'docSidebar', sidebarId: 'strategicSidebar', docsPluginId: 'network', label: 'Strategic Design'},
            {type: 'docSidebar', sidebarId: 'networkModelSidebar', docsPluginId: 'network', label: 'Nodes & Promise'},
            {type: 'docSidebar', sidebarId: 'integrationSidebar', docsPluginId: 'network', label: 'WMS/WES Integration'},
            {type: 'docSidebar', sidebarId: 'contextsSidebar', docsPluginId: 'network', label: 'Bounded Contexts'},
            {type: 'docSidebar', sidebarId: 'apiSidebar', docsPluginId: 'network', label: 'API Reference'},
            {to: '/network/adr', label: 'ADRs'},
          ],
        },
        {
          href: 'https://github.com/IQVO/warehouse-docs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Overview', to: '/overview'},
            {label: 'Strategic Design', to: '/strategic-design/domain-vision'},
            {label: 'WMS and WES', to: '/wms-wes'},
            {label: 'Business Capability Architecture', to: '/business-capability-architecture'},
            {label: 'Bounded Contexts', to: '/contexts'},
          ],
        },
        {
          title: 'retail network',
          items: [
            {label: 'Network Overview', to: '/network/'},
            {label: 'Domain Vision', to: '/network/strategic-design/domain-vision'},
            {label: 'Promise Model', to: '/network/network-model/promise-model'},
            {label: 'WMS/WES Integration', to: '/network/integration/wms-wes-integration'},
          ],
        },
        {
          title: 'Ecosystem repositories',
          items: [
            {label: 'order-management', href: 'https://github.com/IQVO/order-management'},
            {label: 'inventory-storage', href: 'https://github.com/IQVO/inventory-storage'},
            {label: 'wes-work-planning', href: 'https://github.com/IQVO/wes-work-planning'},
            {label: 'fulfillment-execution', href: 'https://github.com/IQVO/fulfillment-execution'},
            {label: 'workforce-management', href: 'https://github.com/IQVO/workforce-management'},
            {label: 'facility-layout', href: 'https://github.com/IQVO/facility-layout'},
            {label: 'process-path-management', href: 'https://github.com/IQVO/process-path-management'},
            {label: 'labor-performance', href: 'https://github.com/IQVO/labor-performance'},
            {label: 'warehouse-ops-agent', href: 'https://github.com/IQVO/warehouse-ops-agent'},
            {label: 'network-fulfillment', href: 'https://github.com/IQVO/network-fulfillment'},
            {label: 'warehouse-planning', href: 'https://github.com/IQVO/warehouse-planning'},
            {label: 'product-master', href: 'https://github.com/IQVO/product-master'},
            {label: 'inbound-receiving', href: 'https://github.com/IQVO/inbound-receiving'},
            {label: 'slotting-optimization', href: 'https://github.com/IQVO/slotting-optimization'},
            {label: 'pick-face-replenishment', href: 'https://github.com/IQVO/pick-face-replenishment'},
            {label: 'network-inventory-planning', href: 'https://github.com/IQVO/network-inventory-planning'},
          ],
        },
        {
          title: 'DDD reference method',
          items: [
            {label: 'ddd-crew (GitHub)', href: 'https://github.com/ddd-crew'},
            {label: 'Bounded Context Canvas', href: 'https://github.com/ddd-crew/bounded-context-canvas'},
            {label: 'Aggregate Design Canvas', href: 'https://github.com/ddd-crew/aggregate-design-canvas'},
            {label: 'Context Mapping', href: 'https://github.com/ddd-crew/context-mapping'},
            {label: 'Core Domain Charts', href: 'https://github.com/ddd-crew/core-domain-charts'},
            {label: 'Domain Message Flow Modelling', href: 'https://github.com/ddd-crew/domain-message-flow-modelling'},
            {label: 'EventStorming Glossary', href: 'https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet'},
            {label: 'DDD Starter Modelling Process', href: 'https://github.com/ddd-crew/ddd-starter-modelling-process'},
          ],
        },
      ],
      copyright: `warehouse-systems documentation — built ${new Date().getFullYear()} with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'go', 'json', 'yaml', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
