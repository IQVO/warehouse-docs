import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/workforce-management-reports/workforce-management-reports-api",
    },
    {
      type: "category",
      label: "Reports",
      link: {
        type: "doc",
        id: "api-reference/rest/workforce-management-reports/reports",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/workforce-management-reports/get-labor-report",
          label: "Labor utilization and staffing per process path and UTC hour",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/workforce-management-reports/get-labor-report-freshness",
          label: "How far the read model trails the event stream",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/workforce-management-reports/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/workforce-management-reports/get-reports-healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
