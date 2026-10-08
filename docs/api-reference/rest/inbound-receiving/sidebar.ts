import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/inbound-receiving/inbound-receiving-api",
    },
    {
      type: "category",
      label: "ASNs",
      link: {
        type: "doc",
        id: "api-reference/rest/inbound-receiving/as-ns",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/register-asn",
          label: "Register an ASN",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/list-asns",
          label: "List ASNs",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/get-asn",
          label: "Get an ASN",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/cancel-asn",
          label: "Cancel an ASN",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Appointments",
      link: {
        type: "doc",
        id: "api-reference/rest/inbound-receiving/appointments",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/book-appointment",
          label: "Book a dock appointment",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/list-appointments",
          label: "List dock appointments",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/get-appointment",
          label: "Get a dock appointment",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/check-in-appointment",
          label: "Check a carrier in",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/cancel-appointment",
          label: "Cancel a dock appointment",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Receipts",
      link: {
        type: "doc",
        id: "api-reference/rest/inbound-receiving/receipts",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/open-receipt",
          label: "Open a receipt",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/list-receipts",
          label: "List receipts",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/get-receipt",
          label: "Get a receipt",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/receive-line",
          label: "Receive a quantity against a line",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/close-receipt",
          label: "Close a receipt",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Docks",
      link: {
        type: "doc",
        id: "api-reference/rest/inbound-receiving/docks",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/list-docks",
          label: "List the inbound dock doors",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/inbound-receiving/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inbound-receiving/readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
