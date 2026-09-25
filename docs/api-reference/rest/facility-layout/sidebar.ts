import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/facility-layout/facility-layout-api",
    },
    {
      type: "category",
      label: "Sites",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/sites",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-site",
          label: "Register a physical facility",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-sites",
          label: "List every registered site",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-site",
          label: "Get one site",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Zones",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/zones",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-zone",
          label: "Register a behavioral zone inside a site's area",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-zones",
          label: "List a site's zones",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-zone",
          label: "Get one zone",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Aisles",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/aisles",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-aisle",
          label: "Register a physical corridor inside a zone",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-aisles",
          label: "List a zone's aisles in walk order",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-aisle",
          label: "Get one aisle",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/set-aisle-geometry",
          label: "Set an aisle's travel centreline",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-cross-aisle",
          label: "Register a connection between two aisles",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Location Types",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/location-types",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-location-type",
          label: "Register a reusable slot classification",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-location-types",
          label: "List every registered location type",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-location-type",
          label: "Get one location type",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Placement Rules",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/placement-rules",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/define-placement-rule",
          label: "Declare which location types are legal in which zones",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-placement-rules",
          label: "List every defined placement rule",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-placement-rule",
          label: "Get one placement rule",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Locations",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/locations",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-location-slot",
          label: "Register one coded location slot",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/import-facility-layout",
          label: "Bulk-import a whole building's layout",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-location-slot",
          label: "Get one location slot",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/set-location-geometry",
          label: "Set a location slot's physical geometry",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-location-classification",
          label: "Get a location slot's resolved hazmat/temperature-class attributes",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/decommission-location-slot",
          label: "Permanently retire a location slot",
          className: "api-method post",
        },
      ],
    },
    {
      type: "category",
      label: "Layout",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/layout",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-site-layout",
          label: "Get a site's full drawable layout",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-locations-by-role",
          label: "List a site's locations by role",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/register-fixed-structure",
          label: "Register a fixed structure",
          className: "api-method post",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/list-fixed-structures",
          label: "List a site's fixed structures",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-zone-grid",
          label: "Get a zone as a 2D renderable grid",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-zone-travel-graph",
          label: "Get one zone's travel graph",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/estimate-travel-distance",
          label: "Compute the shortest travel distance between two locations",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/facility-layout/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/facility-layout/get-healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
