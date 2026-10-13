import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/fulfillment-execution-reports/fulfillment-execution-reports-api",
    },
    {
      type: "category",
      label: "Reports",
      link: {
        type: "doc",
        id: "api-reference/rest/fulfillment-execution-reports/reports",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/fulfillment-execution-reports/get-throughput-report",
          label: "Throughput & Lease-Health report, keyed by task type, station and UTC hour",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/fulfillment-execution-reports/get-throughput-freshness",
          label: "How far the read model trails the event stream",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "System",
      link: {
        type: "doc",
        id: "api-reference/rest/fulfillment-execution-reports/system",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/fulfillment-execution-reports/get-reports-healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
