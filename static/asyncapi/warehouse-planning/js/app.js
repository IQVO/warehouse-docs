
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "warehouse-planning Domain Events",
    "version": "0.4.0",
    "contact": {
      "name": "warehouse-planning maintainers",
      "url": "https://github.com/IQVO/warehouse-planning",
      "email": "warehouse-planning@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event catalog for the **warehouse-planning** bounded context (WES\nsubdomain): *can this warehouse process the demand assigned to it?*\n\n**Published (Phase 4).** The `CapacityPlan` aggregate raises four events,\npublished to `warehouse.warehouse-planning.events` through a\n**transactional outbox**: the plan and its already-encoded events are\nwritten in ONE database transaction, and a relay drains them to Kafka\n(at-least-once; the CloudEvents `id` is persisted with the outbox row, so\na retry republishes the same `id` -- consumers dedupe on it). Per plan:\n`CapacityPlanCreated` on creation; on publication\n`CapacityPlanPublished`, plus `CapacityShortageDetected` and\n`BottleneckDetected` only when the plan has a shortage.\n`ProcessCapacityRegistered`/`ProcessCapacityChanged` are NOT published yet.\n\n**Consumed (Phase 3).** `ShiftPlanCommitted` (workforce-management) and\n`LocationSlotRegistered`/`LocationSlotDecommissioned` (facility-layout) keep\nlocal ProcessCapacity read models current; this context never makes a\nlive cross-context call.\n\n**Envelope (mandatory).** Every message is a CloudEvents 1.0 event in\n*structured content mode* (Kafka value = JSON event format) with the Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`. All of\n`specversion` (`1.0`), `id`, `source` (`/warehouse/warehouse-planning`),\n`type`, `subject`, `time`, `datacontenttype` (`application/json`) and\n`dataschema` are required; the payload sits under `data`. No flat\nenvelope, no toggle.\n\n**Type naming.** `com.warehouse.wes.warehouse-planning.<entity>.<EventName>`\nwhere `<entity>` is the aggregate that raised the event, lowercase, no\nseparators -- here `capacityplan`. **dataschema** =\n`urn:warehouse:warehouse-planning:events:<EventName>:v1`. **subject** and\nthe Kafka message key = the capacity plan id (one plan's events stay\nordered on one partition). A breaking payload change gets a new `.v2`\ntype and dataschema, never a mutation.\n"
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
      "name": "warehouse-planning",
      "description": "The warehouse-planning bounded context (WES subdomain)."
    },
    {
      "name": "capacity-plan",
      "description": "Events raised by the CapacityPlan aggregate (published, Phase 4)."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes (Phase 3)."
    }
  ],
  "channels": {
    "warehouse.warehouse-planning.events": {
      "description": "This service's integration topic (`Topic` in\n`internal/adapters/outbound/kafka/encoder.go`). Written by the outbox\nrelay; key = capacity plan id; every message carries the\n`content-type: application/cloudevents+json; charset=UTF-8` header.\nDispatch on the full `type`, ignore unknown types, dedupe on `id`.\n",
      "subscribe": {
        "operationId": "receiveCapacityPlanEvents",
        "summary": "Receive CapacityPlan events.",
        "description": "Subscribe to the CapacityPlan event stream. Route on the full `type`\n(`com.warehouse.wes.warehouse-planning.capacityplan.<EventName>`).\n",
        "tags": [
          {
            "name": "capacity-plan"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "CapacityPlanCreated",
              "title": "Capacity plan created",
              "summary": "A DRAFT CapacityPlan was created with its computed shortage.",
              "description": "Raised by the `CapacityPlan` aggregate on `POST /capacity-plans` and queued\nin the transactional outbox in the same transaction as the plan. `type` =\n`com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanCreated`, `subject` and Kafka key = the plan id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "capacity-plan"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of CapacityPlanCreated.",
                "allOf": [
                  {
                    "type": "object",
                    "description": "CloudEvents 1.0 structured-mode envelope. Every attribute below is required; the context's own payload sits under data.\n",
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
                        "description": "UUID v4, minted once per domain event and persisted with the outbox row, so a redelivery repeats it. Dedupe on it.",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "example": "/warehouse/warehouse-planning",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "Full reverse-DNS type; dispatch on the whole string.",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "Aggregate instance id (never empty).",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Domain occurred-at, UTC.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:<repo>:events:<EventName>:v<N>.",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "data": {
                        "type": "object",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventEnvelope"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanCreated",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityPlanCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload of CapacityPlanCreated.",
                        "required": [
                          "plan_id",
                          "warehouse_id",
                          "location",
                          "path_id",
                          "window_start",
                          "window_end",
                          "assigned_demand",
                          "path_capacity",
                          "capacity_over_window",
                          "shortage",
                          "bottleneck_step",
                          "status"
                        ],
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "description": "The CapacityPlan id (UUID); equals the CloudEvents subject.",
                            "example": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "warehouse_id": {
                            "type": "string",
                            "description": "Warehouse the plan is for.",
                            "example": "WH-1",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "location": {
                            "type": "string",
                            "description": "ProcessCapacity location the plan evaluates.",
                            "example": "PATH-ZONE-A",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "ProcessPath evaluated.",
                            "example": "pick-rebin-pack",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window start (RFC 3339, UTC).",
                            "example": "2026-10-05T08:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window end, exclusive (RFC 3339, UTC).",
                            "example": "2026-10-05T16:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "assigned_demand": {
                            "type": "number",
                            "format": "double",
                            "description": "Orders assigned to the window.",
                            "example": 12000,
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "path_capacity": {
                            "type": "number",
                            "format": "double",
                            "description": "Normalized path capacity, ORDER per HOUR.",
                            "example": 1000,
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          },
                          "capacity_over_window": {
                            "type": "number",
                            "format": "double",
                            "description": "path_capacity x window hours, in orders.",
                            "example": 8000,
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "shortage": {
                            "type": "number",
                            "format": "double",
                            "description": "max(0, assigned_demand - capacity_over_window), in orders. Never negative.",
                            "example": 4000,
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "description": "The ProcessPath step limiting end-to-end flow.",
                            "example": "REBIN",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "status": {
                            "type": "string",
                            "enum": [
                              "DRAFT"
                            ],
                            "description": "Always DRAFT at creation.",
                            "example": "DRAFT",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          }
                        },
                        "x-parser-schema-id": "CapacityPlanCreatedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-10>"
                  }
                ],
                "x-parser-schema-id": "CapacityPlanCreatedEvent"
              },
              "examples": [
                {
                  "name": "draftPlanWithShortage",
                  "summary": "A plan for 12000 orders over 8h on Pick -> Rebin -> Pack (1000 ORDER/h): short by 4000.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/warehouse-planning",
                    "type": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanCreated",
                    "subject": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                    "time": "2026-10-04T21:15:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:warehouse-planning:events:CapacityPlanCreated:v1",
                    "data": {
                      "plan_id": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                      "warehouse_id": "WH-1",
                      "location": "PATH-ZONE-A",
                      "path_id": "pick-rebin-pack",
                      "window_start": "2026-10-05T08:00:00Z",
                      "window_end": "2026-10-05T16:00:00Z",
                      "assigned_demand": 12000,
                      "path_capacity": 1000,
                      "capacity_over_window": 8000,
                      "shortage": 4000,
                      "bottleneck_step": "REBIN",
                      "status": "DRAFT"
                    }
                  }
                }
              ]
            },
            {
              "name": "CapacityPlanPublished",
              "title": "Capacity plan published",
              "summary": "A DRAFT CapacityPlan was published.",
              "description": "Raised by `CapacityPlan.Publish` on `POST /capacity-plans/{id}/publish`.\nAlways accompanied by `CapacityShortageDetected` and `BottleneckDetected`\nwhen the plan has a shortage. A plan is published at most once. `type` =\n`com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "capacity-plan"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of CapacityPlanPublished.",
                "allOf": [
                  "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished",
                        "x-parser-schema-id": "<anonymous-schema-26>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityPlanPublished:v1",
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload of CapacityPlanPublished.",
                        "required": [
                          "plan_id",
                          "warehouse_id",
                          "location",
                          "path_id",
                          "window_start",
                          "window_end",
                          "assigned_demand",
                          "path_capacity",
                          "capacity_over_window",
                          "shortage",
                          "bottleneck_step",
                          "published_at"
                        ],
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "description": "The CapacityPlan id (UUID); equals the CloudEvents subject.",
                            "example": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                            "x-parser-schema-id": "<anonymous-schema-28>"
                          },
                          "warehouse_id": {
                            "type": "string",
                            "description": "Warehouse the plan is for.",
                            "example": "WH-1",
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          },
                          "location": {
                            "type": "string",
                            "description": "ProcessCapacity location the plan evaluates.",
                            "example": "PATH-ZONE-A",
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "ProcessPath evaluated.",
                            "example": "pick-rebin-pack",
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window start (RFC 3339, UTC).",
                            "example": "2026-10-05T08:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window end, exclusive (RFC 3339, UTC).",
                            "example": "2026-10-05T16:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "assigned_demand": {
                            "type": "number",
                            "format": "double",
                            "description": "Orders assigned to the window.",
                            "example": 12000,
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "path_capacity": {
                            "type": "number",
                            "format": "double",
                            "description": "Normalized path capacity, ORDER per HOUR.",
                            "example": 1000,
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "capacity_over_window": {
                            "type": "number",
                            "format": "double",
                            "description": "path_capacity x window hours, in orders.",
                            "example": 8000,
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "shortage": {
                            "type": "number",
                            "format": "double",
                            "description": "max(0, assigned_demand - capacity_over_window), in orders. Never negative.",
                            "example": 4000,
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "description": "The ProcessPath step limiting end-to-end flow.",
                            "example": "REBIN",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "published_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the plan was published (RFC 3339, UTC).",
                            "example": "2026-10-04T21:45:10Z",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          }
                        },
                        "x-parser-schema-id": "CapacityPlanPublishedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-25>"
                  }
                ],
                "x-parser-schema-id": "CapacityPlanPublishedEvent"
              },
              "examples": [
                {
                  "name": "publishedPlan",
                  "summary": "The section-43 plan, published.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a8d7c6b-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
                    "source": "/warehouse/warehouse-planning",
                    "type": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished",
                    "subject": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                    "time": "2026-10-04T21:45:10Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:warehouse-planning:events:CapacityPlanPublished:v1",
                    "data": {
                      "plan_id": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                      "warehouse_id": "WH-1",
                      "location": "PATH-ZONE-A",
                      "path_id": "pick-rebin-pack",
                      "window_start": "2026-10-05T08:00:00Z",
                      "window_end": "2026-10-05T16:00:00Z",
                      "assigned_demand": 12000,
                      "path_capacity": 1000,
                      "capacity_over_window": 8000,
                      "shortage": 4000,
                      "bottleneck_step": "REBIN",
                      "published_at": "2026-10-04T21:45:10Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "CapacityShortageDetected",
              "title": "Capacity shortage detected",
              "summary": "Published demand exceeds the path capacity over the window.",
              "description": "Raised at publish time, ONLY when `shortage > 0` (demand exactly equal to\nthe capacity over the window is not a shortage). `type` =\n`com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "capacity-plan"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of CapacityShortageDetected.",
                "allOf": [
                  "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityShortageDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload of CapacityShortageDetected. shortage is always > 0 here.",
                        "required": [
                          "plan_id",
                          "warehouse_id",
                          "location",
                          "path_id",
                          "window_start",
                          "window_end",
                          "assigned_demand",
                          "capacity_over_window",
                          "shortage",
                          "bottleneck_step"
                        ],
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "description": "The CapacityPlan id (UUID); equals the CloudEvents subject.",
                            "example": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "warehouse_id": {
                            "type": "string",
                            "description": "Warehouse the plan is for.",
                            "example": "WH-1",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "location": {
                            "type": "string",
                            "description": "ProcessCapacity location the plan evaluates.",
                            "example": "PATH-ZONE-A",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "ProcessPath evaluated.",
                            "example": "pick-rebin-pack",
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window start (RFC 3339, UTC).",
                            "example": "2026-10-05T08:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window end, exclusive (RFC 3339, UTC).",
                            "example": "2026-10-05T16:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-48>"
                          },
                          "assigned_demand": {
                            "type": "number",
                            "format": "double",
                            "description": "Orders assigned to the window.",
                            "example": 12000,
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "capacity_over_window": {
                            "type": "number",
                            "format": "double",
                            "description": "path_capacity x window hours, in orders.",
                            "example": 8000,
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "shortage": {
                            "type": "number",
                            "format": "double",
                            "description": "max(0, assigned_demand - capacity_over_window), in orders. Never negative.",
                            "example": 4000,
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "description": "The ProcessPath step limiting end-to-end flow.",
                            "example": "REBIN",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          }
                        },
                        "x-parser-schema-id": "CapacityShortageDetectedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-40>"
                  }
                ],
                "x-parser-schema-id": "CapacityShortageDetectedEvent"
              },
              "examples": [
                {
                  "name": "shortageOf4000",
                  "summary": "12000 orders assigned, 8000 orders of capacity: short by 4000, bound by REBIN.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3b2a1c0d-9e8f-4d7c-b6a5-4f3e2d1c0b9a",
                    "source": "/warehouse/warehouse-planning",
                    "type": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected",
                    "subject": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                    "time": "2026-10-04T21:45:10Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:warehouse-planning:events:CapacityShortageDetected:v1",
                    "data": {
                      "plan_id": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                      "warehouse_id": "WH-1",
                      "location": "PATH-ZONE-A",
                      "path_id": "pick-rebin-pack",
                      "window_start": "2026-10-05T08:00:00Z",
                      "window_end": "2026-10-05T16:00:00Z",
                      "assigned_demand": 12000,
                      "capacity_over_window": 8000,
                      "shortage": 4000,
                      "bottleneck_step": "REBIN"
                    }
                  }
                }
              ]
            },
            {
              "name": "BottleneckDetected",
              "title": "Bottleneck detected",
              "summary": "Names the path step limiting end-to-end flow of a plan with a shortage.",
              "description": "Raised at publish time together with `CapacityShortageDetected`, ONLY when\nthe plan has a shortage. `type` = `com.warehouse.wes.warehouse-planning.capacityplan.BottleneckDetected`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "capacity-plan"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of BottleneckDetected.",
                "allOf": [
                  "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.BottleneckDetected",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:BottleneckDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload of BottleneckDetected.",
                        "required": [
                          "plan_id",
                          "warehouse_id",
                          "location",
                          "path_id",
                          "window_start",
                          "window_end",
                          "bottleneck_step",
                          "path_capacity"
                        ],
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "description": "The CapacityPlan id (UUID); equals the CloudEvents subject.",
                            "example": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "warehouse_id": {
                            "type": "string",
                            "description": "Warehouse the plan is for.",
                            "example": "WH-1",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "location": {
                            "type": "string",
                            "description": "ProcessCapacity location the plan evaluates.",
                            "example": "PATH-ZONE-A",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "ProcessPath evaluated.",
                            "example": "pick-rebin-pack",
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window start (RFC 3339, UTC).",
                            "example": "2026-10-05T08:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Planning window end, exclusive (RFC 3339, UTC).",
                            "example": "2026-10-05T16:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-61>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "description": "The ProcessPath step limiting end-to-end flow.",
                            "example": "REBIN",
                            "x-parser-schema-id": "<anonymous-schema-62>"
                          },
                          "path_capacity": {
                            "type": "number",
                            "format": "double",
                            "description": "Normalized path capacity, ORDER per HOUR.",
                            "example": 1000,
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          }
                        },
                        "x-parser-schema-id": "BottleneckDetectedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-53>"
                  }
                ],
                "x-parser-schema-id": "BottleneckDetectedEvent"
              },
              "examples": [
                {
                  "name": "rebinBottleneck",
                  "summary": "REBIN limits the Pick -> Rebin -> Pack path to 1000 ORDER/h.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918",
                    "source": "/warehouse/warehouse-planning",
                    "type": "com.warehouse.wes.warehouse-planning.capacityplan.BottleneckDetected",
                    "subject": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                    "time": "2026-10-04T21:45:10Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:warehouse-planning:events:BottleneckDetected:v1",
                    "data": {
                      "plan_id": "0b7a4c1e-5d52-4f0e-9a39-6c1f2f3a8b10",
                      "warehouse_id": "WH-1",
                      "location": "PATH-ZONE-A",
                      "path_id": "pick-rebin-pack",
                      "window_start": "2026-10-05T08:00:00Z",
                      "window_end": "2026-10-05T16:00:00Z",
                      "bottleneck_step": "REBIN",
                      "path_capacity": 1000
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.workforce.events": {
      "description": "workforce-management's integration topic (`LaborTopic`). This service\nconsumes it with its own consumer group (env `LABOR_CAPACITY_CONSUMER_GROUP`).\n",
      "publish": {
        "operationId": "consumeShiftPlanCommitted",
        "summary": "Consume workforce-management's ShiftPlanCommitted.",
        "description": "Consumed by this service: one message per PathPlan line becomes a\nLABOR capacity constraint. Offsets are committed only after the\neffect and its idempotency claim committed atomically.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "ShiftPlanCommitted",
          "title": "Shift plan committed (consumed)",
          "summary": "workforce-management committed a headcount split for a path.",
          "description": "CONSUMED from `warehouse.workforce.events` (producer: workforce-management;\none message per PathPlan line). Becomes a LABOR `CapacityConstraint` on the\nProcessCapacity of ProcessType = upper-case(`path_id`), location =\n`building_id`: rate = `planned_heads * planned_rate` (UNIT/HOUR), window =\n`[time, time + planned_hours)`. Deduped on the CloudEvents `id`.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            },
            {
              "name": "warehouse-planning"
            }
          ],
          "payload": {
            "description": "CloudEvents 1.0 envelope of workforce-management's ShiftPlanCommitted (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                    "x-parser-schema-id": "<anonymous-schema-65>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                    "x-parser-schema-id": "<anonymous-schema-66>"
                  },
                  "data": {
                    "type": "object",
                    "description": "Fields this service reads from one fanned-out ShiftPlanCommitted message (one per PathPlan line).",
                    "required": [
                      "path_id",
                      "planned_heads",
                      "planned_rate",
                      "planned_hours"
                    ],
                    "properties": {
                      "building_id": {
                        "type": "string",
                        "example": "BLD1",
                        "x-parser-schema-id": "<anonymous-schema-67>"
                      },
                      "shift_id": {
                        "type": "string",
                        "example": "SHIFT1",
                        "x-parser-schema-id": "<anonymous-schema-68>"
                      },
                      "path_id": {
                        "type": "string",
                        "description": "Becomes the ProcessType (upper-cased) of the LABOR constraint.",
                        "example": "pack",
                        "x-parser-schema-id": "<anonymous-schema-69>"
                      },
                      "planned_heads": {
                        "type": "integer",
                        "example": 3,
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      },
                      "planned_rate": {
                        "type": "number",
                        "format": "double",
                        "example": 50,
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      },
                      "planned_hours": {
                        "type": "number",
                        "format": "double",
                        "example": 8,
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      }
                    },
                    "x-parser-schema-id": "ShiftPlanCommittedData"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-64>"
              }
            ],
            "x-parser-schema-id": "ShiftPlanCommittedEvent"
          },
          "examples": [
            {
              "name": "packLine",
              "summary": "One fanned-out line of a plan committed for building BLD1.",
              "payload": {
                "specversion": "1.0",
                "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                "source": "/warehouse/workforce-management",
                "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                "subject": "BLD1/SHIFT1",
                "time": "2026-10-04T22:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                "data": {
                  "building_id": "BLD1",
                  "shift_id": "SHIFT1",
                  "path_id": "pack",
                  "planned_heads": 3,
                  "planned_rate": 50,
                  "planned_hours": 8
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.facility.events": {
      "description": "facility-layout's integration topic (`FacilityTopic`). This service\nconsumes it with its own consumer group (env `STORAGE_CAPACITY_CONSUMER_GROUP`).\n",
      "publish": {
        "operationId": "consumeLocationSlotEvents",
        "summary": "Consume facility-layout's location slot events.",
        "description": "Consumed by this service: storage positions (per zone + locationType) and\nwork-center stations (per zone + activity) are tallied. The consumer only\nmaintains that tally -- it registers no ProcessCapacity constraint.\nStation counts are composed with labor and the operator-declared station\nstandard at read time, and positions are a read model\n(`GET /storage-capacity`); see docs/adr/0002-station-capacity-composition.md.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "LocationSlotRegistered",
              "title": "Location slot registered (consumed)",
              "summary": "facility-layout registered a storage position or a work center.",
              "description": "CONSUMED from `warehouse.facility.events` (producer: facility-layout). Tallied\nper (zoneId, locationType) as storage positions (role Storage), or per\nzone + activity as stations (role WorkCenter). A zone belongs to the site\n(planning location) named by its zone id's first dash-separated segment.\nDeduped on the CloudEvents `id`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of facility-layout's LocationSlotRegistered (consumed).",
                "allOf": [
                  "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationSlotRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-75>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Fields this service reads from LocationSlotRegistered.",
                        "required": [
                          "locationCode",
                          "zoneId",
                          "locationType"
                        ],
                        "properties": {
                          "locationCode": {
                            "type": "string",
                            "example": "A-01-01",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "zoneId": {
                            "type": "string",
                            "example": "ZONE-A",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "locationType": {
                            "type": "string",
                            "example": "BULK",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "role": {
                            "type": "string",
                            "description": "Storage (default) tallies storage positions per locationType; WorkCenter tallies stations per activity.",
                            "example": "Storage",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          },
                          "activities": {
                            "type": "array",
                            "description": "Present only when role is WorkCenter.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-81>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          }
                        },
                        "x-parser-schema-id": "LocationSlotRegisteredData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-73>"
                  }
                ],
                "x-parser-schema-id": "LocationSlotRegisteredEvent"
              },
              "examples": [
                {
                  "name": "storageSlot",
                  "summary": "A bulk storage position registered in ZONE-A.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c4b3a29-1807-4f6e-8d5c-4b3a29180716",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                    "subject": "A-01-01",
                    "time": "2026-10-04T20:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:LocationSlotRegistered:v1",
                    "data": {
                      "locationCode": "A-01-01",
                      "zoneId": "ZONE-A",
                      "locationType": "BULK",
                      "role": "Storage"
                    }
                  }
                }
              ]
            },
            {
              "name": "LocationSlotDecommissioned",
              "title": "Location slot decommissioned (consumed)",
              "summary": "facility-layout decommissioned a position.",
              "description": "CONSUMED from `warehouse.facility.events` (producer: facility-layout).\nDecrements the tally the matching LocationSlotRegistered incremented; an\nuntracked `locationCode` is logged and ignored.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                },
                {
                  "name": "warehouse-planning"
                }
              ],
              "payload": {
                "description": "CloudEvents 1.0 envelope of facility-layout's LocationSlotDecommissioned (consumed).",
                "allOf": [
                  "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned",
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationSlotDecommissioned:v1",
                        "x-parser-schema-id": "<anonymous-schema-84>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Fields this service reads from LocationSlotDecommissioned.",
                        "required": [
                          "locationCode"
                        ],
                        "properties": {
                          "locationCode": {
                            "type": "string",
                            "example": "A-01-01",
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          }
                        },
                        "x-parser-schema-id": "LocationSlotDecommissionedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-82>"
                  }
                ],
                "x-parser-schema-id": "LocationSlotDecommissionedEvent"
              },
              "examples": [
                {
                  "name": "slotRemoved",
                  "summary": "Position A-01-01 decommissioned.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2d1c0b9a-8776-4554-a332-1d0c9b8a7665",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned",
                    "subject": "A-01-01",
                    "time": "2026-10-04T23:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:LocationSlotDecommissioned:v1",
                    "data": {
                      "locationCode": "A-01-01"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "CapacityPlanCreated": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0]",
      "CapacityPlanPublished": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[1]",
      "CapacityShortageDetected": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[2]",
      "BottleneckDetected": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[3]",
      "ShiftPlanCommitted": "$ref:$.channels.warehouse.workforce.events.publish.message",
      "LocationSlotRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0]",
      "LocationSlotDecommissioned": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "CapacityPlanCreatedData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "CapacityPlanPublishedData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[1].payload.allOf[1].properties.data",
      "CapacityShortageDetectedData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data",
      "BottleneckDetectedData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "CapacityPlanCreatedEvent": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload",
      "CapacityPlanPublishedEvent": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[1].payload",
      "CapacityShortageDetectedEvent": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[2].payload",
      "BottleneckDetectedEvent": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[3].payload",
      "ShiftPlanCommittedData": "$ref:$.channels.warehouse.workforce.events.publish.message.payload.allOf[1].properties.data",
      "LocationSlotRegisteredData": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0].payload.allOf[1].properties.data",
      "LocationSlotDecommissionedData": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1].payload.allOf[1].properties.data",
      "ShiftPlanCommittedEvent": "$ref:$.channels.warehouse.workforce.events.publish.message.payload",
      "LocationSlotRegisteredEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0].payload",
      "LocationSlotDecommissionedEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1].payload"
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
  