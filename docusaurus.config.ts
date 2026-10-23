import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';

const config: Config = {
  title: 'retail-network Documentation',
  tagline:
    'A marketplace-scale retail and logistics network, modelled with Domain-Driven Design, and how it connects to the warehouse-systems WMS/WES fleet.',
  favicon: 'img/favicon.svg',
  future: {v4: true, faster: true},
  url: 'https://iqvo.github.io',
  baseUrl: '/retail-network-docs/',
  organizationName: 'IQVO',
  projectName: 'retail-network-docs',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  i18n: {defaultLocale: 'en', locales: ['en']},
  markdown: {
    mermaid: true,
    hooks: {onBrokenMarkdownLinks: 'throw'},
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          editUrl: 'https://github.com/IQVO/retail-network-docs/tree/main/',
          docItemComponent: '@theme/ApiItem',
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
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
          nodeTopology: {
            specPath: 'apis/node-topology/openapi.yaml',
            outputDir: 'docs/api-reference/rest/node-topology',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          offerAvailability: {
            specPath: 'apis/offer-availability/openapi.yaml',
            outputDir: 'docs/api-reference/rest/offer-availability',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          deliveryPromise: {
            specPath: 'apis/delivery-promise/openapi.yaml',
            outputDir: 'docs/api-reference/rest/delivery-promise',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          customerOrdering: {
            specPath: 'apis/customer-ordering/openapi.yaml',
            outputDir: 'docs/api-reference/rest/customer-ordering',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          orderSourcing: {
            specPath: 'apis/order-sourcing/openapi.yaml',
            outputDir: 'docs/api-reference/rest/order-sourcing',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          vendorConnectivity: {
            specPath: 'apis/vendor-connectivity/openapi.yaml',
            outputDir: 'docs/api-reference/rest/vendor-connectivity',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          linehaulTransportation: {
            specPath: 'apis/linehaul-transportation/openapi.yaml',
            outputDir: 'docs/api-reference/rest/linehaul-transportation',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          lastMileDelivery: {
            specPath: 'apis/last-mile-delivery/openapi.yaml',
            outputDir: 'docs/api-reference/rest/last-mile-delivery',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          shippingAndTracking: {
            specPath: 'apis/shipping-and-tracking/openapi.yaml',
            outputDir: 'docs/api-reference/rest/shipping-and-tracking',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
          nodePerformance: {
            specPath: 'apis/node-performance/openapi.yaml',
            outputDir: 'docs/api-reference/rest/node-performance',
            sidebarOptions: {groupPathsBy: 'tag', categoryLinkSource: 'tag'},
            hideSendButton: true,
          },
        } satisfies Record<string, OpenApiPlugin.Options>,
      },
    ],
  ],
  themes: ['@docusaurus/theme-mermaid', 'docusaurus-theme-openapi-docs'],
  themeConfig: {
    colorMode: {respectPrefersColorScheme: true},
    mermaid: {theme: {light: 'neutral', dark: 'dark'}},
    navbar: {
      title: 'retail-network Docs',
      logo: {alt: 'retail-network', src: 'img/logo.svg'},
      items: [
        {type: 'docSidebar', sidebarId: 'researchSidebar', position: 'left', label: 'Research'},
        {type: 'docSidebar', sidebarId: 'strategicSidebar', position: 'left', label: 'Strategic Design'},
        {type: 'docSidebar', sidebarId: 'networkModelSidebar', position: 'left', label: 'Nodes & Promise'},
        {type: 'docSidebar', sidebarId: 'integrationSidebar', position: 'left', label: 'WMS/WES Integration'},
        {type: 'docSidebar', sidebarId: 'contextsSidebar', position: 'left', label: 'Bounded Contexts'},
        {type: 'docSidebar', sidebarId: 'apiSidebar', position: 'left', label: 'API Reference'},
        {to: '/adr', label: 'ADRs', position: 'left'},
        {href: 'https://github.com/IQVO/retail-network-docs', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'This site',
          items: [
            {label: 'Overview', to: '/'},
            {label: 'Domain Vision', to: '/strategic-design/domain-vision'},
            {label: 'Promise Model', to: '/network-model/promise-model'},
            {label: 'WMS/WES Integration', to: '/integration/wms-wes-integration'},
          ],
        },
        {
          title: 'warehouse-systems',
          items: [
            {label: 'Fleet docs (warehouse-docs)', href: 'https://iqvo.github.io/warehouse-docs/'},
            {label: 'network-fulfillment', href: 'https://github.com/IQVO/network-fulfillment'},
            {label: 'order-management', href: 'https://github.com/IQVO/order-management'},
          ],
        },
      ],
      copyright: `retail-network domain documentation. This project is a domain-driven design study. It is not associated with, endorsed by or affiliated with any company, and it uses no company's code, data, logos or trademarks. All names, figures and examples are illustrative or synthetic.`,
    },
    prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['yaml', 'json', 'bash']},
  } satisfies Preset.ThemeConfig,
};

export default config;
