import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

interface ContextCard {
  slug: string;
  name: string;
  tier: 'Core' | 'Supporting' | 'Generic';
}

const WMS_CONTEXTS: ContextCard[] = [
  {slug: 'order-management', name: 'order-management', tier: 'Supporting'},
  {slug: 'inventory-storage', name: 'inventory-storage', tier: 'Core'},
  {slug: 'wes-work-planning', name: 'wes-work-planning', tier: 'Core'},
  {slug: 'fulfillment-execution', name: 'fulfillment-execution', tier: 'Core'},
  {slug: 'workforce-management', name: 'workforce-management', tier: 'Supporting'},
  {slug: 'facility-layout', name: 'facility-layout', tier: 'Generic'},
  {slug: 'process-path-management', name: 'process-path-management', tier: 'Generic'},
  {slug: 'labor-performance', name: 'labor-performance', tier: 'Supporting'},
  {slug: 'warehouse-ops-agent', name: 'warehouse-ops-agent', tier: 'Supporting'},
  {slug: 'network-fulfillment', name: 'network-fulfillment', tier: 'Supporting'},
  {slug: 'warehouse-planning', name: 'warehouse-planning', tier: 'Core'},
  {slug: 'product-master', name: 'product-master', tier: 'Supporting'},
  {slug: 'inbound-receiving', name: 'inbound-receiving', tier: 'Supporting'},
  {slug: 'slotting-optimization', name: 'slotting-optimization', tier: 'Supporting'},
  {slug: 'network-inventory-planning', name: 'network-inventory-planning', tier: 'Core'},
  {slug: 'pick-face-replenishment', name: 'pick-face-replenishment', tier: 'Supporting'},
  {slug: 'task-interleaving', name: 'task-interleaving', tier: 'Supporting'},
];

const NETWORK_CONTEXTS: ContextCard[] = [
  {slug: 'node-topology', name: 'node-topology', tier: 'Supporting'},
  {slug: 'offer-availability', name: 'offer-availability', tier: 'Supporting'},
  {slug: 'delivery-promise', name: 'delivery-promise', tier: 'Core'},
  {slug: 'customer-ordering', name: 'customer-ordering', tier: 'Generic'},
  {slug: 'order-sourcing', name: 'order-sourcing', tier: 'Core'},
  {slug: 'vendor-connectivity', name: 'vendor-connectivity', tier: 'Supporting'},
  {slug: 'linehaul-transportation', name: 'linehaul-transportation', tier: 'Supporting'},
  {slug: 'last-mile-delivery', name: 'last-mile-delivery', tier: 'Supporting'},
  {slug: 'shipping-and-tracking', name: 'shipping-and-tracking', tier: 'Generic'},
  {slug: 'node-performance', name: 'node-performance', tier: 'Supporting'},
];

const TIER_CLASS: Record<ContextCard['tier'], string> = {
  Core: 'badge-core',
  Supporting: 'badge-supporting',
  Generic: 'badge-generic',
};

const SECTIONS = [
  {
    key: 'wms',
    name: 'WMS / WES',
    tagline: 'The warehouse execution fleet',
    description:
      'Nineteen backend contexts — receiving, storage, slotting, picking, packing, shipping and the planning around them — one shared ubiquitous language and a single documented context map. Generated from each context\u2019s own OpenAPI and AsyncAPI specifications, ADRs and domain source.',
    links: [
      {label: 'Overview', to: '/overview'},
      {label: 'Strategic Design', to: '/strategic-design/domain-vision'},
      {label: 'Context Map', to: '/strategic-design/context-map'},
      {label: 'API Reference', to: '/api-reference'},
    ],
  },
  {
    key: 'network',
    name: 'Retail Network',
    tagline: 'The large-scale retail & logistics network',
    description:
      'Eleven bounded contexts modelling catalogue, delivery promise, order sourcing, vendor connectivity, seller inbound, middle and last mile, tracking and node performance — the seam through which the network connects to the WMS/WES fleet. Source of truth: the retail-network domain model.',
    links: [
      {label: 'Network Overview', to: '/network'},
      {label: 'Domain Vision', to: '/network/strategic-design/domain-vision'},
      {label: 'Promise Model', to: '/network/network-model/promise-model'},
      {label: 'WMS/WES Integration', to: '/network/integration/wms-wes-integration'},
    ],
  },
  {
    key: 'storefront',
    name: 'Digital Storefront',
    tagline: 'The e-commerce storefront on the retail network',
    description:
      'Six bounded contexts (pricing, product content, product discovery, shopping cart, checkout, customer payments) plus the storefront-bff edge, the React SSR web app and a payment-provider simulator. Built on develop, not deployed yet. Source of truth: the storefront domain model.',
    links: [
      {label: 'Storefront Overview', to: '/storefront'},
      {label: 'Context Map', to: '/storefront/strategic-design/context-map'},
      {label: 'Bounded Contexts', to: '/storefront/contexts'},
      {label: 'API Reference', to: '/storefront/api-reference'},
    ],
  },
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.hero)}>
      <div className="container">
        <p className={styles.eyebrow}>IQVO · ecosystem documentation</p>
        <Heading as="h1" className={styles.heroTitle}>
          {siteConfig.title}
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <p className={styles.heroLead}>
          Two domains, one site: the WMS/WES warehouse execution fleet and the
          retail network it serves. Every page is generated from each
          context&rsquo;s own specifications and ADRs — never hand-transcribed.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/overview">
            WMS/WES docs
          </Link>
          <Link className="button button--primary button--lg" to="/network">
            Retail Network docs
          </Link>
        </div>
      </div>
    </header>
  );
}

function SectionHub() {
  return (
    <section className="container">
      <div className={styles.sectionGrid}>
        {SECTIONS.map((section) => (
          <div key={section.key} className={styles.sectionCard}>
            <p className={styles.sectionTagline}>{section.tagline}</p>
            <Heading as="h2" className={styles.sectionName}>
              {section.name}
            </Heading>
            <p className={styles.sectionDescription}>{section.description}</p>
            <div className={styles.sectionLinks}>
              {section.links.map((link) => (
                <Link key={link.to} className={styles.sectionLink} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContextGrid({
  heading,
  basePath,
  contexts,
}: {
  heading: string;
  basePath: string;
  contexts: ContextCard[];
}) {
  return (
    <section className="container">
      <Heading as="h2" className={styles.gridHeading}>
        {heading}
      </Heading>
      <div className={styles.contextGrid}>
        {contexts.map((ctx) => (
          <Link
            key={ctx.slug}
            className={styles.contextCard}
            to={`${basePath}/${ctx.slug}`}>
            <div className={styles.contextName}>{ctx.name}</div>
            <span className={TIER_CLASS[ctx.tier]}>{ctx.tier}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="IQVO ecosystem documentation: the WMS/WES warehouse execution fleet and the retail network domain — strategic and tactical DDD artifacts, REST and AsyncAPI references, and business context for every bounded context.">
      <HomepageHeader />
      <main>
        <SectionHub />
        <ContextGrid
          heading="WMS/WES bounded contexts"
          basePath="/contexts"
          contexts={WMS_CONTEXTS}
        />
        <ContextGrid
          heading="Retail Network bounded contexts"
          basePath="/network/contexts"
          contexts={NETWORK_CONTEXTS}
        />
      </main>
    </Layout>
  );
}
