import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/returns-processing/returns-processing-api",
    },
    {
      type: "category",
      label: "Returns",
      link: {
        type: "doc",
        id: "api-reference/rest/returns-processing/returns",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/authorize-return",
          label: "Authorize a return (open an RMA)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/list-returns-by-order",
          label: "List the RMAs of an order",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/get-return",
          label: "Get an RMA",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Receipts",
      link: {
        type: "doc",
        id: "api-reference/rest/returns-processing/receipts",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/open-return-receipt",
          label: "Open a return receipt against an RMA",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/inspect-return-line",
          label: "Grade a receipt line and decide its disposition",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Dispositions",
      link: {
        type: "doc",
        id: "api-reference/rest/returns-processing/dispositions",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/override-disposition",
          label: "Override a disposition with a reason",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Disposition policies",
      link: {
        type: "doc",
        id: "api-reference/rest/returns-processing/disposition-policies",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/declare-disposition-policy",
          label: "Declare a disposition policy version",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/get-disposition-policy",
          label: "Get the current disposition policy",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/returns-processing/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/returns-processing/metrics",
          label: "Prometheus metrics",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
