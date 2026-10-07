import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebar: SidebarsConfig = {
  apisidebar: [
    {
      type: "doc",
      id: "api-reference/rest/product-master/product-master-api",
    },
    {
      type: "category",
      label: "Products",
      link: {
        type: "doc",
        id: "api-reference/rest/product-master/products",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/product-master/list-products",
          label: "List products",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/register-product",
          label: "Register a product or change its description",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/get-product",
          label: "Get a product",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Classification",
      link: {
        type: "doc",
        id: "api-reference/rest/product-master/classification",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/product-master/classify-product",
          label: "Set or replace a product's handling classification",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/get-product-classification",
          label: "Get a product's handling classification",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Physical profile",
      link: {
        type: "doc",
        id: "api-reference/rest/product-master/physical-profile",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/product-master/declare-dimensions",
          label: "Declare a product's unit dimensions and weight",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/record-measurement",
          label: "Record a measurement of one unit",
          className: "api-method put",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/get-physical-profile",
          label: "Get a product's physical profile",
          className: "api-method get",
        },
      ],
    },
    {
      type: "category",
      label: "Health",
      link: {
        type: "doc",
        id: "api-reference/rest/product-master/health",
      },
      items: [
        {
          type: "doc",
          id: "api-reference/rest/product-master/healthz",
          label: "Liveness probe",
          className: "api-method get",
        },
        {
          type: "doc",
          id: "api-reference/rest/product-master/readyz",
          label: "Readiness probe",
          className: "api-method get",
        },
      ],
    },
  ],
};

export default sidebar.apisidebar;
