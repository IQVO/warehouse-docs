import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/inventory-storage/inventory-storage-api",
    },
    {
      type: "category",
      label: "Stock",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/stock",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/receive-stock",
          label: "Acknowledge inbound stock for a SKU",
          className: "menu__list-item--deprecated api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/stow-stock",
          label: "Stow received stock into a bin",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/relocate-stock",
          label: "Move stock of one SKU between two bins of the same site",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-relocation",
          label: "Read one relocation",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Containers",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/containers",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-container",
          label: "Read one container",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/stow-container",
          label: "Stow a sealed case into a case bin",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/break-case",
          label: "Break a sealed case into loose eaches",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/list-bin-containers",
          label: "List the containers stowed in a bin",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Reservations",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/reservations",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-reservations-by-demand-ref",
          label: "Look up every reservation for a demand reference",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/reserve-stock",
          label: "Create a revocable reservation against usable inventory",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/revoke-reservation",
          label: "Revoke a reservation",
          className: "api-method delete",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/confirm-pick",
          label: "Confirm a reservation's physical pick",
          className: "menu__list-item--deprecated api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Inventory",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/inventory",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-usable-inventory",
          label: "Get usable inventory for a SKU",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Bins",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/bins",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/register-bin",
          label: "Register a bin, or converge an existing bin to a capacity",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-bin",
          label: "Get a bin's capacity and occupancy",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/run-cycle-count",
          label: "Record a physical cycle count for a bin",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Transfers",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/transfers",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/stage-transfer-receipt",
          label: "Stage a destination transfer receipt (count an arrival)",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/stow-transfer-stock",
          label: "Stow a staged transfer receipt into destination bins",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Reports",
      link: {
        type: "doc",
        id: "api-reference/rest/inventory-storage/reports",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-flow-accuracy-report",
          label: "Inventory Flow & Accuracy report (hourly)",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/inventory-storage/get-flow-accuracy-freshness",
          label: "Freshness lag of the flow-accuracy read model",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
