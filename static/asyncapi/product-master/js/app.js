
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "product-master Domain Events",
    "version": "1.0.0",
    "contact": {
      "name": "product-master maintainers",
      "url": "https://github.com/IQVO/product-master",
      "email": "product-master@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event catalog for the **product-master** bounded context (WMS subdomain):\nSKU-level product master data, i.e. handling classification and the\nphysical profile (ADR 0001, ADR 0002).\n\n**Published.** The `Product` aggregate raises five events, published to\n`warehouse.product-master.events` through a **transactional outbox**: the\nproduct row and its already-encoded events are written in ONE database\ntransaction and a relay drains them to Kafka (at-least-once; the CloudEvents\n`id` is stored with the outbox row, so a retry republishes the same `id`).\nA change that alters nothing raises no event.\n\n**Local copies, not lookups.** Sibling contexts (inventory-storage,\norder-management, wes-work-planning, fulfillment-execution) keep a local\ncopy keyed by SKU. Every payload carries the aggregate `version` after the\nchange; apply a message only when its `version` is greater than the stored\none. Payloads are full-state per concern (classification, physical profile),\nso a consumer overwrites, it never merges.\n\n**Consumed (migration only, ADR 0003).** inventory-storage's legacy\n`ProductClassified` on `warehouse.inventory.events`, read by the legacy\nimporter when `LEGACY_IMPORT_CONSUMER_GROUP` is set.\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\n`specversion`, `id`, `source` (`/warehouse/product-master`), `type`,\n`subject` (the SKU), `time`, `datacontenttype` (`application/json`) and\n`dataschema` (`urn:warehouse:product-master:events:<EventName>:v1`) are all\nrequired. Kafka key = the SKU. Type =\n`com.warehouse.wms.product-master.product.<EventName>`. A breaking payload\nchange is a new `.v2` type, never a mutation.\n"
  },
  "servers": {
    "production": {
      "url": "{brokers}",
      "protocol": "kafka",
      "description": "Fleet-shared Kafka broker (host supplied by the deployment environment).",
      "variables": {
        "brokers": {
          "default": "kafka.warehouse-systems.internal:9092"
        }
      }
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "tags": [
    {
      "name": "product-master",
      "description": "The product-master bounded context (WMS subdomain)."
    },
    {
      "name": "product",
      "description": "Events raised by the Product aggregate."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes (migration only)."
    }
  ],
  "channels": {
    "warehouse.product-master.events": {
      "description": "This service's integration topic. Written by the outbox relay; key = SKU;\nevery message carries the CloudEvents content-type header. Dispatch on the\nfull `type`, ignore unknown types, dedupe on `id`, apply by `version`.\n",
      "subscribe": {
        "operationId": "receiveProductEvents",
        "summary": "Receive Product events.",
        "description": "Subscribe to the product master data stream. Route on the full `type`\n(`com.warehouse.wms.product-master.product.<EventName>`).\n",
        "tags": [
          {
            "name": "product"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProductRegistered",
              "title": "Product registered",
              "summary": "A SKU was registered as a product.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductRegistered`; subject and key = the SKU.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "required": [
                      "specversion",
                      "id",
                      "source",
                      "type",
                      "subject",
                      "time",
                      "datacontenttype",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "specversion": {
                        "type": "string",
                        "const": "1.0",
                        "x-parser-schema-id": "<anonymous-schema-1>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "The SKU.",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventEnvelope"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "description",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-11>"
                          },
                          "description": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-12>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "ProductRegisteredEvent"
              },
              "examples": [
                {
                  "name": "registered",
                  "summary": "SKU-1 registered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1b0c9a4e-2f7d-4a63-9d1e-5a7c3e2b9f10",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductRegistered",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductRegistered:v1",
                    "data": {
                      "sku": "SKU-1",
                      "description": "Lithium battery pack 12V",
                      "version": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductDescriptionChanged",
              "title": "Product description changed",
              "summary": "A registered product's description changed.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductDescriptionChanged`; subject and key = the SKU.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "description",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "description": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-14>"
                  }
                ],
                "x-parser-schema-id": "ProductDescriptionChangedEvent"
              },
              "examples": [
                {
                  "name": "described",
                  "summary": "SKU-1's description changed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8d3f2c1a-6b5e-4f7a-9c0d-1e2f3a4b5c6d",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductDescriptionChanged",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductDescriptionChanged:v1",
                    "data": {
                      "sku": "SKU-1",
                      "description": "Lithium battery pack 12V, 7Ah",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductClassified",
              "title": "Product classified",
              "summary": "A product's handling classification was set or replaced.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductClassified`;\nsubject and key = the SKU. Full-state replacement of the\nclassification. `sku`, `handling_tags`, `temperature_class` and\n`dot_hazard_class` keep the field names of inventory-storage's v1\npayload (ADR 0004). Optional fields are omitted when unset.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "handling_tags",
                          "classification_source",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "handling_tags": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                              "type": "string",
                              "enum": [
                                "Hazmat",
                                "Fragile",
                                "TemperatureSensitive",
                                "Oversized",
                                "HighValue"
                              ],
                              "x-parser-schema-id": "HandlingTag"
                            },
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          },
                          "temperature_class": {
                            "type": "string",
                            "enum": [
                              "Ambient",
                              "Chilled",
                              "Frozen"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "dot_hazard_class": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 9,
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "classification_source": {
                            "type": "string",
                            "enum": [
                              "native",
                              "legacy-import"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-20>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-19>"
                  }
                ],
                "x-parser-schema-id": "ProductClassifiedEvent"
              },
              "examples": [
                {
                  "name": "hazmatFrozen",
                  "summary": "SKU-1 classified Hazmat + TemperatureSensitive (Frozen), DOT class 3.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "0f6d8a2b-3c4e-4d5f-8a9b-7c6d5e4f3a2b",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductClassified",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:02:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductClassified:v1",
                    "data": {
                      "sku": "SKU-1",
                      "handling_tags": [
                        "Hazmat",
                        "TemperatureSensitive"
                      ],
                      "temperature_class": "Frozen",
                      "dot_hazard_class": 3,
                      "classification_source": "native",
                      "version": 3
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductDimensionsDeclared",
              "title": "Product dimensions declared",
              "summary": "Declared unit dimensions and weight were set or replaced.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductDimensionsDeclared`;\nsubject and key = the SKU. Carries the FULL physical profile after the\nchange (ADR 0002); act on `effective`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "effective_source",
                          "discrepancy",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          },
                          "declared": {
                            "type": "object",
                            "required": [
                              "length_mm",
                              "width_mm",
                              "height_mm",
                              "weight_g",
                              "volume_mm3"
                            ],
                            "properties": {
                              "length_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-30>"
                              },
                              "width_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-31>"
                              },
                              "height_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-32>"
                              },
                              "weight_g": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 2000000,
                                "x-parser-schema-id": "<anonymous-schema-33>"
                              },
                              "volume_mm3": {
                                "type": "integer",
                                "minimum": 1,
                                "x-parser-schema-id": "<anonymous-schema-34>"
                              }
                            },
                            "x-parser-schema-id": "Dimensions"
                          },
                          "measured": {
                            "allOf": [
                              "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data.properties.declared",
                              {
                                "type": "object",
                                "required": [
                                  "measured_at"
                                ],
                                "properties": {
                                  "measured_at": {
                                    "type": "string",
                                    "format": "date-time",
                                    "x-parser-schema-id": "<anonymous-schema-36>"
                                  },
                                  "device_id": {
                                    "type": "string",
                                    "description": "Omitted for a manual measurement.",
                                    "x-parser-schema-id": "<anonymous-schema-37>"
                                  }
                                },
                                "x-parser-schema-id": "<anonymous-schema-35>"
                              }
                            ],
                            "x-parser-schema-id": "MeasuredDimensions"
                          },
                          "effective": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data.properties.declared",
                          "effective_source": {
                            "type": "string",
                            "enum": [
                              "measured",
                              "declared",
                              "none"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "discrepancy": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-27>"
                  }
                ],
                "x-parser-schema-id": "PhysicalProfileEvent"
              },
              "examples": [
                {
                  "name": "declared",
                  "summary": "SKU-1 declared at 200x120x80 mm, 1500 g.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductDimensionsDeclared",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:03:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductDimensionsDeclared:v1",
                    "data": {
                      "sku": "SKU-1",
                      "declared": {
                        "length_mm": 200,
                        "width_mm": 120,
                        "height_mm": 80,
                        "weight_g": 1500,
                        "volume_mm3": 1920000
                      },
                      "effective": {
                        "length_mm": 200,
                        "width_mm": 120,
                        "height_mm": 80,
                        "weight_g": 1500,
                        "volume_mm3": 1920000
                      },
                      "effective_source": "declared",
                      "discrepancy": false,
                      "version": 4
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductMeasured",
              "title": "Product measured",
              "summary": "A measurement of one unit was recorded and is now effective.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductMeasured`;\nsubject and key = the SKU. Carries the FULL physical profile after the\nchange (ADR 0002); act on `effective`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product"
                }
              ],
              "payload": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload",
              "examples": [
                {
                  "name": "measuredWithDiscrepancy",
                  "summary": "SKU-1 measured heavier than declared (more than 10 %).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductMeasured",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:04:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductMeasured:v1",
                    "data": {
                      "sku": "SKU-1",
                      "declared": {
                        "length_mm": 200,
                        "width_mm": 120,
                        "height_mm": 80,
                        "weight_g": 1500,
                        "volume_mm3": 1920000
                      },
                      "measured": {
                        "length_mm": 205,
                        "width_mm": 121,
                        "height_mm": 82,
                        "weight_g": 1720,
                        "volume_mm3": 2034010,
                        "measured_at": "2026-10-06T14:05:00Z",
                        "device_id": "CUBISCAN-03"
                      },
                      "effective": {
                        "length_mm": 205,
                        "width_mm": 121,
                        "height_mm": 82,
                        "weight_g": 1720,
                        "volume_mm3": 2034010
                      },
                      "effective_source": "measured",
                      "discrepancy": true,
                      "version": 5
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.inventory.events": {
      "description": "inventory-storage's integration topic. Consumed ONLY by the legacy\nimporter during the migration (ADR 0003), with a stable consumer group\nread from env `LEGACY_IMPORT_CONSUMER_GROUP` (unset = not started). Every\ntype other than inventory-storage's `ProductClassified` is ignored.\n",
      "publish": {
        "operationId": "consumeLegacyProductClassified",
        "summary": "Consume inventory-storage's legacy ProductClassified.",
        "description": "Imports a classification authored in inventory-storage. Unknown SKUs\nare registered; a classification authored in product-master\n(`classification_source=native`) is never overwritten. The CloudEvents\n`id` claim and the effect commit in one transaction; the offset is\ncommitted afterwards.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "LegacyProductClassified",
          "title": "inventory-storage ProductClassified (legacy, consumed)",
          "summary": "inventory-storage's classification event, imported during the migration.",
          "description": "`type` = `com.warehouse.wms.inventory-storage.product.ProductClassified`,\nsource `/warehouse/inventory-storage`, dataschema\n`urn:warehouse:inventory-storage:events:ProductClassified:v1`. Produced\nby inventory-storage (its ADR 0031); retired by its ADR 0034.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "sku",
                      "handling_tags"
                    ],
                    "properties": {
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-43>"
                      },
                      "handling_tags": {
                        "type": "array",
                        "items": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data.properties.handling_tags.items",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "temperature_class": {
                        "type": "string",
                        "enum": [
                          "Ambient",
                          "Chilled",
                          "Frozen"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      },
                      "dot_hazard_class": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 9,
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-42>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-41>"
              }
            ],
            "x-parser-schema-id": "LegacyProductClassifiedEvent"
          },
          "examples": [
            {
              "name": "legacy",
              "summary": "A legacy hazmat classification.",
              "payload": {
                "specversion": "1.0",
                "id": "3c2b1a0f-9e8d-4c7b-a6f5-e4d3c2b1a0f9",
                "source": "/warehouse/inventory-storage",
                "type": "com.warehouse.wms.inventory-storage.product.ProductClassified",
                "subject": "SKU-9",
                "time": "2026-10-06T20:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:inventory-storage:events:ProductClassified:v1",
                "data": {
                  "sku": "SKU-9",
                  "handling_tags": [
                    "Hazmat"
                  ],
                  "dot_hazard_class": 9
                }
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "ProductRegistered": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0]",
      "ProductDescriptionChanged": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[1]",
      "ProductClassified": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[2]",
      "ProductDimensionsDeclared": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3]",
      "ProductMeasured": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[4]",
      "LegacyProductClassified": "$ref:$.channels.warehouse.inventory.events.publish.message"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "HandlingTag": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data.properties.handling_tags.items",
      "Dimensions": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data.properties.declared",
      "MeasuredDimensions": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data.properties.measured",
      "ProductRegisteredEvent": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[0].payload",
      "ProductDescriptionChangedEvent": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[1].payload",
      "ProductClassifiedEvent": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[2].payload",
      "PhysicalProfileEvent": "$ref:$.channels.warehouse.product-master.events.subscribe.message.oneOf[3].payload",
      "LegacyProductClassifiedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.payload"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  