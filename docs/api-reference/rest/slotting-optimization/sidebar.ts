import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/slotting-optimization/slotting-optimization-api",
    },
    {
      type: "category",
      label: "Slot plans",
      link: {
        type: "doc",
        id: "api-reference/rest/slotting-optimization/slot-plans",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/generate-slot-plan",
          label: "Generate a slot plan",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/list-slot-plans",
          label: "List slot plans",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/get-slot-plan",
          label: "Get a slot plan",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/approve-slot-plan",
          label: "Approve a Draft plan",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/reject-slot-plan",
          label: "Reject a Draft plan",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Forward slots",
      link: {
        type: "doc",
        id: "api-reference/rest/slotting-optimization/forward-slots",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/list-forward-slots",
          label: "The current approved forward-slot map",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Velocity",
      link: {
        type: "doc",
        id: "api-reference/rest/slotting-optimization/velocity",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/list-sku-velocity",
          label: "SKU velocity over a window",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/slotting-optimization/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/slotting-optimization/readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
