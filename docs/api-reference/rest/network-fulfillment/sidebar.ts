import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/network-fulfillment/network-fulfillment-api",
    },
    {
      type: "category",
      label: "network-orders",
      link: {
        type: "doc",
        id: "api-reference/rest/network-fulfillment/network-orders",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/network-fulfillment/list-unanswered-network-orders",
          label: "List orders still awaiting an answer",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/network-fulfillment/get-network-order",
          label: "Get one network order",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "operations",
      link: {
        type: "doc",
        id: "api-reference/rest/network-fulfillment/operations",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/network-fulfillment/healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/network-fulfillment/get-inbound-status",
          label: "Is the inbound polling leg alive?",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
