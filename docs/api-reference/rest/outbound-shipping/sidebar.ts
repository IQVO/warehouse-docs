import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/outbound-shipping/outbound-shipping-api",
    },
    {
      type: "category",
      label: "Packages",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/packages",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/stage-package",
          label: "Stage a manifested package (create a staging)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/load-package",
          label: "Load a package onto its load (create a loading)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/unload-package",
          label: "Unload a package back to staging (create an unloading)",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Loads",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/loads",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/close-load",
          label: "Close a loading load (create a closure)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/reopen-load",
          label: "Reopen a closed load (create a reopening)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/cancel-load",
          label: "Cancel a planned load (create a cancellation)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/list-loads",
          label: "List outbound loads (keyset paginated)",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/get-load",
          label: "Read one outbound load",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/list-load-packages",
          label: "List the packages of one load (keyset paginated)",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Bills of lading",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/bills-of-lading",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/void-bill-of-lading",
          label: "Void an issued bill of lading (create a void)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/get-bill-of-lading",
          label: "Read one bill of lading",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Sweeps",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/sweeps",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/run-missed-load-sweep",
          label: "Sweep for packages that missed their load (create a sweep)",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Reports",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/reports",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/get-load-adherence-report",
          label: "Per-cutoff load adherence report",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/outbound-shipping/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/get-liveness",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/outbound-shipping/get-readiness",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
