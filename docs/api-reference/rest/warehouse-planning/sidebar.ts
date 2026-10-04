import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/warehouse-planning/warehouse-planning",
    },
    {
      type: "category",
      label: "process-capacities",
      link: {
        type: "doc",
        id: "api-reference/rest/warehouse-planning/process-capacities",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/register-process-capacity-constraint",
          label: "Register (or upsert) one capacity constraint",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/get-effective-process-capacity",
          label: "Get the effective capacity for a process, location and window",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "process-paths",
      link: {
        type: "doc",
        id: "api-reference/rest/warehouse-planning/process-paths",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/register-process-path",
          label: "Register (seed) a ProcessPath read model",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/get-process-path-capacity",
          label: "Get a ProcessPath's normalized, end-to-end capacity",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "capacity-plans",
      link: {
        type: "doc",
        id: "api-reference/rest/warehouse-planning/capacity-plans",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/create-capacity-plan",
          label: "Create a DRAFT CapacityPlan and compute its shortage",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/get-capacity-plan",
          label: "Get a CapacityPlan",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/publish-capacity-plan",
          label: "Publish a DRAFT CapacityPlan",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "station-capacity",
      link: {
        type: "doc",
        id: "api-reference/rest/warehouse-planning/station-capacity",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/declare-station-standard",
          label: "Declare the throughput of ONE station of a process at a site",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/list-station-standards",
          label: "List the declared station standards",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/warehouse-planning/get-storage-capacity",
          label: "Storage positions and stations of a site (read model)",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
