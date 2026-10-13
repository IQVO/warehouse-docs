import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/facility-layout-reports/facility-layout-reports-api",
    },
    {
      type: "category",
      label: "reports",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout-reports/reports",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout-reports/get-catalog-growth-report",
          label: "Layout Catalog Growth report, keyed by scope and UTC day",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout-reports/get-catalog-growth-freshness",
          label: "How far the read model trails the event stream",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "health",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout-reports/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout-reports/get-reports-healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout-reports/get-reports-readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
