
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Workforce Management Events",
    "version": "1.0.0",
    "description": "Domain-event catalog for **Workforce Management**, a Supporting bounded\ncontext in the WES (Warehouse Execution Systems) subdomain. It owns \"who\nis on shift, on which process path, at what rate; direct vs indirect\nhours\" — the shift-start planning horizon (a human commits a split of\nheadcount across paths) plus intra-shift assignment tracking (moving\nassociates between paths as backlogs deviate). It stops at the path\nboundary: it never links an associate to a specific task, and it never\ndecides a rebalance — it makes the labor picture legible and enforces its\ninvariants.\n\nThree aggregates raise the events documented here:\n\n- `AssociateShift` (package `internal/domain/associate`) — roster entry:\n  who is on, their certifications, their break state, their logged hours.\n  Raises `AssociateShiftStarted`, `AssociateCertified`,\n  `AssociateBreakStarted`, `AssociateBreakEnded`, `AssociateShiftEnded`.\n- `ShiftPlan` (package `internal/domain/shiftplan`) — the committed split\n  of headcount across paths for one site's shift (`siteCode`; `buildingId`\n  is its deprecated alias, ADR 0035), made of `PathPlan`\n  lines. Raises `ShiftPlanProposed`, `ShiftPlanCommitted` and the\n  staffing-gap flag `PathUnderstaffed`.\n- `LaborAssignment` (package `internal/domain/assignment`) — one\n  associate on one path for an interval, with exactly one ACTIVE\n  assignment per associate at a time. Raises `LaborAssigned` and\n  `LaborReassigned`.\n\n**Envelope (mandatory).** Every Kafka message this service produces or\nconsumes is a CloudEvents 1.0 event in *structured content mode*\n(ADR-0026, superseding the envelope half of ADR-0004): the Kafka message\nvalue is the JSON event format, content type\n`application/cloudevents+json`, and every message carries the Kafka header\n`content-type: application/cloudevents+json; charset=UTF-8` alongside the\nW3C `traceparent`/`tracestate` headers. All of `specversion` (`1.0`),\n`id`, `source` (`/warehouse/workforce-management`), `type`, `subject`,\n`time`, `datacontenttype` (`application/json`) and `dataschema` are\nREQUIRED; the bounded context's own payload sits under `data`. There is\nno flat envelope and no envelope toggle.\n\n**Type naming convention.** The CloudEvents `type` attribute is\nreverse-DNS dotted and follows the exact shape\n`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`, all\nlowercase except the final PascalCase event name. For this context the\nsubdomain is `wes` and the bounded context is `workforce-management`, so\nfor example a committed shift plan is published as\n`com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted`.\nThe `entity` segment is the aggregate that raises the event —\n`associate`, `shiftplan` or `assignment`. `PathUnderstaffed` uses\n`shiftplan`, since the gap is measured against a committed `ShiftPlan`'s\nplanned heads. A breaking payload change gets a new `.v2` type and a new\n`dataschema` version, never a mutation of the old one.\n\n**dataschema.** `urn:warehouse:workforce-management:<stream>:<EventName>:v1`\nwhere `<stream>` is `events` for `warehouse.workforce.events` and\n`analytics` for `warehouse.workforce.analytics`. The same occurrence keeps\nthe same `type` on both topics; `dataschema` names the payload shape.\n\n**Subject.** The aggregate instance id: the associate id for\n`associate`/`assignment` events, the path id for `PathUnderstaffed` and\n`ShiftPlanProposed`, and the ShiftPlan aggregate id\n`<buildingId>/<shiftId>` for `ShiftPlanCommitted` (the same value as the\nintegration message's Kafka key). The first segment of that id IS the site\ncode (ADR 0035): the subject and the Kafka key are unchanged by the\nsiteCode convergence, so no consumer's partitioning or ordering moves.\n\n**siteCode / buildingId (ADR 0035).** The ShiftPlan key has one canonical\nname, `siteCode` (the facility-layout Site code), and one deprecated alias,\n`buildingId`, with the SAME value. `ShiftPlanProposed` and\n`ShiftPlanCommitted` (v1, both topics where published) therefore carry\n`site_code` next to the unchanged, now deprecated, `building_id`. The\nchange is additive: no `.v2`, nothing removed, `site_code` is not\n`required` in the schema because messages produced before the addition lack\nit. Removing `building_id` is a future breaking change with its own ADR.\n\n**Which events leave the process on which topic.** The integration topic\n`warehouse.workforce.events` carries **only** `ShiftPlanCommitted`, fanned\nout into one message per `PathPlan` line. Every event in this catalog is\npublished to the internal analytics topic\n`warehouse.workforce.analytics` (consumed by this service's own analytics\nprojector, ADR-0010). Each message below pins its exact `type` and\n`dataschema` and documents the payload actually on the wire.\n",
    "contact": {
      "name": "Workforce Management — claudioed",
      "url": "https://github.com/claudioed/workforce-management",
      "email": "claudioed.oliveira@gmail.com"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0"
    }
  },
  "tags": [
    {
      "name": "workforce-management",
      "description": "The Workforce Management bounded context (WES subdomain) — headcount\nplanning per shift and intra-shift labor assignment tracking.\n"
    },
    {
      "name": "associate",
      "description": "Events raised by the `AssociateShift` aggregate — roster membership,\ncertifications and break state for one associate on one shift.\n"
    },
    {
      "name": "shiftplan",
      "description": "Events raised by the `ShiftPlan` aggregate — proposed and committed\nheadcount splits across process paths, and the understaffing flag\nderived from a committed plan.\n"
    },
    {
      "name": "assignment",
      "description": "Events raised by the `LaborAssignment` aggregate — an associate placed\non a path for an interval, and moves between paths.\n"
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Shared warehouse-systems Kafka cluster. Workforce Management publishes\nits outbound domain events here; downstream bounded contexts (Work\nPlanning) consume from the same cluster.\n"
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.workforce.events": {
      "description": "The single outbound topic for this bounded context, matching the\n`Topic` constant in `internal/adapters/outbound/kafka/publisher.go`\n(`warehouse.workforce.events`). Messages are CloudEvents 1.0\nstructured-mode JSON with the `content-type:\napplication/cloudevents+json; charset=UTF-8` Kafka header. Consumers\nmust dispatch on the full `type`, ignore unknown `type` values, and\ndedupe on `id`.\n",
      "subscribe": {
        "operationId": "consumeWorkforceEvents",
        "summary": "Consume Workforce Management domain events.",
        "description": "Subscribe to the Workforce Management domain-event stream. Every\nmessage is a CloudEvents 1.0 structured-mode event; route on the full\n`type` context attribute, which follows\n`com.warehouse.wes.workforce-management.<entity>.<EventName>`.\n\nOnly `ShiftPlanCommitted` is published to this topic, fanned out into\none message per `PathPlan` line of the committed plan, each with its\nown unique `id`. The remaining messages listed here are published to\nthe analytics topic only — see each message's description.\n",
        "tags": [
          {
            "name": "workforce-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ShiftPlanCommitted",
              "title": "Shift plan committed",
              "summary": "A human committed a headcount split across process paths for a site's shift.",
              "description": "Raised by the `ShiftPlan` aggregate when a human commits the split of\nheadcount across process paths for one site's shift. The commit\nis validated in the domain: `plannedHeads(path)` must not exceed\n`installedStations(path)`, and planned hours must fit the shift's max\nhours.\n\n**Published to `warehouse.workforce.events`.** This is the only\ndomain event on the integration topic; wes-work-planning dispatches on\nits exact `type`. The adapter loads the committed\nplan through the `ShiftPlanRepo` and **fans the single domain event\nout into one Kafka message per `PathPlan` line** — a plan committed\nwith three path lines produces three messages on\n`warehouse.workforce.events`, each carrying that one line's\n`path_id`, `planned_heads`, `planned_rate` and `planned_hours`\nalongside the plan's `site_code` (canonical) and `building_id`\n(deprecated, same value) and `shift_id`. Consumers must\ntherefore expect N messages per commit, not one, and must not assume\na message carries the whole plan. Every line message has its own\nunique CloudEvents `id` (minted once and persisted with the outbox\nrow, so a redelivery repeats it); `subject` is the ShiftPlan aggregate\nid `<buildingId>/<shiftId>`, identical to the Kafka key.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shiftplan"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "ShiftPlanCommitted CloudEvent",
                "description": "CloudEvent for one `PathPlan` line of a committed\n`ShiftPlan`. The `data` fields mirror exactly what the Kafka\npublisher emits per line.\n",
                "allOf": [
                  {
                    "type": "object",
                    "title": "CloudEvents 1.0 context attributes",
                    "description": "The CloudEvents 1.0 structured-mode context attributes shared by\nevery message (ADR-0026). Every attribute is REQUIRED. Each event\nschema below composes this base with an `allOf` and pins its own\n`type` const and `dataschema` const.\n",
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
                        "description": "CloudEvents specification version. Always \"1.0\" on this channel.",
                        "enum": [
                          "1.0"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-1>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "Unique identifier of this event occurrence, a UUID v4 minted once\nby the publisher and persisted with the outbox row, so a\nredelivery carries the same id. `(source, id)` is the consumer\nidempotency key.\n",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "description": "The producing context. Always \"/warehouse/workforce-management\".",
                        "enum": [
                          "/warehouse/workforce-management"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "Reverse-DNS event type,\n`com.warehouse.wes.workforce-management.<entity>.<EventName>`.\n",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "Identifier of the aggregate instance this occurrence is about —\nan associate id, a path id, or a `buildingId/shiftId` pair. Never\nempty.\n",
                        "minLength": 1,
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "RFC3339 UTC timestamp of when the event occurred in the domain.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "description": "Content type of the `data` member. Always \"application/json\".",
                        "enum": [
                          "application/json"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "Absolute URI naming the payload shape,\n`urn:warehouse:workforce-management:<events|analytics>:<EventName>:v<N>`.\n",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The event payload.",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventBase"
                  },
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "type": "object",
                        "description": "One committed PathPlan line, in the context of its building and shift.",
                        "required": [
                          "building_id",
                          "shift_id",
                          "path_id",
                          "planned_heads",
                          "planned_rate",
                          "planned_hours"
                        ],
                        "properties": {
                          "site_code": {
                            "type": "string",
                            "description": "Canonical name of the shift-plan key (ADR 0035): the Site\ncode the shift plan was committed for. Carries the SAME\nvalue as `building_id`. Added after v1 shipped, so it is\ndeliberately not `required` -- messages produced before\nthe addition lack it; consumers must fall back to\n`building_id` when it is absent. The first segment of\n`subject` and of the Kafka key is this value.\n",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "building_id": {
                            "type": "string",
                            "deprecated": true,
                            "description": "DEPRECATED -- use `site_code`; same value. Kept, not\nremoved (additive change, no `.v2`); removal needs a later\nbreaking ADR. Site the shift plan was committed for.\n",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "shift_id": {
                            "type": "string",
                            "description": "Shift the plan covers. One ShiftPlan exists per site per shift.",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "Process path this line plans headcount for, e.g. \"pack\".",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "planned_heads": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Heads committed to this path. Never exceeds the path's installed stations.",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "planned_rate": {
                            "type": "number",
                            "description": "Planned units per hour per head used to size this line.",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "planned_hours": {
                            "type": "number",
                            "description": "Total labor hours committed to this path for the shift.",
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-10>"
                  }
                ],
                "x-parser-schema-id": "ShiftPlanCommittedEvent"
              },
              "examples": [
                {
                  "name": "packLineCommitted",
                  "summary": "One of three messages fanned out from a plan committed for building BLD1, shift SHIFT1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                    "subject": "BLD1/SHIFT1",
                    "time": "2026-08-21T22:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                    "data": {
                      "site_code": "BLD1",
                      "building_id": "BLD1",
                      "shift_id": "SHIFT1",
                      "path_id": "pack",
                      "planned_heads": 3,
                      "planned_rate": 50,
                      "planned_hours": 24
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.workforce.analytics": {
      "description": "Internal analytics topic (ADR-0010), matching the `AnalyticsTopic`\nconstant in `internal/adapters/outbound/kafka/analytics_publisher.go`.\nEvery domain event this context raises is published here as a\nCloudEvents 1.0 structured-mode event with dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`. Consumed\nby this service's own analytics projector (`workforce-analytics`\nconsumer group), which dedupes on `id` and dead-letters anything that\nfails CloudEvents validation to `warehouse.workforce.analytics.dlq`.\n",
      "subscribe": {
        "operationId": "consumeWorkforceAnalytics",
        "summary": "Consume Workforce Management analytics events.",
        "description": "Subscribe to the analytics stream. Route on the full `type`; the same\noccurrence carries the same `type` as on the integration topic, and\n`dataschema` distinguishes the analytics payload shape.\n",
        "tags": [
          {
            "name": "workforce-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ShiftPlanCommitted",
              "title": "Shift plan committed (analytics)",
              "summary": "The analytics-topic form of a shift-plan commit — one message per commit, not per line.",
              "description": "Published only to `warehouse.workforce.analytics`. Same `type` as the\nintegration message, different `dataschema` and payload: one message\nper commit carrying just the plan's identity. Kafka key is the\nbuilding id; `subject` is the ShiftPlan aggregate id\n`<buildingId>/<shiftId>`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shiftplan"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "ShiftPlanCommitted analytics CloudEvent",
                "description": "CloudEvent for one shift-plan commit on the analytics topic.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event (same occurrence type as the integration message).",
                        "const": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:ShiftPlanCommitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The committed plan's identity.",
                        "required": [
                          "building_id",
                          "shift_id"
                        ],
                        "properties": {
                          "site_code": {
                            "type": "string",
                            "description": "Canonical name of the shift-plan key (ADR 0035): the Site\ncode the shift plan was committed for. Carries the SAME\nvalue as `building_id`. Added after v1 shipped, so it is\ndeliberately not `required` -- messages produced before\nthe addition lack it; consumers must fall back to\n`building_id` when it is absent.\n",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "building_id": {
                            "type": "string",
                            "deprecated": true,
                            "description": "DEPRECATED -- use `site_code`; same value. Kept, not\nremoved (additive change, no `.v2`); removal needs a later\nbreaking ADR. Site the shift plan was committed for.\n",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "shift_id": {
                            "type": "string",
                            "description": "Shift the plan covers.",
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-24>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-21>"
                  }
                ],
                "x-parser-schema-id": "ShiftPlanCommittedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "planCommittedAnalytics",
                  "summary": "The analytics record of a plan committed for building BLD1, shift SHIFT1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f2a9c1d-7b3e-4d8a-9e61-2c5b7a0d3f19",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                    "subject": "BLD1/SHIFT1",
                    "time": "2026-08-21T22:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:ShiftPlanCommitted:v1",
                    "data": {
                      "site_code": "BLD1",
                      "building_id": "BLD1",
                      "shift_id": "SHIFT1"
                    }
                  }
                }
              ]
            },
            {
              "name": "ShiftPlanProposed",
              "title": "Shift plan proposed",
              "summary": "Heads for a path were computed from charge and planned rate, ahead of any human commit.",
              "description": "Raised by the `ShiftPlan` aggregate when heads for a path are\nproposed as a pure computation — `heads = ceil(charge / plannedRate)`\n— before a human commits anything. A proposal is advisory: the\nsoftware proposes, a human commits.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shiftplan"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "ShiftPlanProposed CloudEvent",
                "description": "CloudEvent for a proposed, not-yet-committed headcount figure for one path.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanProposed",
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:ShiftPlanProposed:v1",
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The computed proposal for one path, ahead of a human commit.",
                        "required": [
                          "building_id",
                          "path_id",
                          "planned_heads",
                          "planned_rate"
                        ],
                        "properties": {
                          "site_code": {
                            "type": "string",
                            "description": "Canonical name of the shift-plan key (ADR 0035): the Site\ncode the proposal was computed for. Carries the SAME\nvalue as `building_id`. Added after v1 shipped, so it is\ndeliberately not `required`; consumers must fall back to\n`building_id` when it is absent.\n",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "building_id": {
                            "type": "string",
                            "deprecated": true,
                            "description": "DEPRECATED -- use `site_code`; same value. Kept, not\nremoved (additive change, no `.v2`); removal needs a later\nbreaking ADR. Site the proposal was computed for.\n",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "Process path the heads were proposed for.",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "planned_heads": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Proposed heads, computed as ceil(charge / plannedRate).",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "planned_rate": {
                            "type": "number",
                            "description": "Planned units per hour per head used in the computation.",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-31>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-28>"
                  }
                ],
                "x-parser-schema-id": "ShiftPlanProposedEvent"
              },
              "examples": [
                {
                  "name": "packHeadsProposed",
                  "summary": "Six heads proposed for the pack path at a planned rate of 50 units/hour.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41aa",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanProposed",
                    "subject": "BLD1/pack",
                    "time": "2026-08-21T21:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:ShiftPlanProposed:v1",
                    "data": {
                      "site_code": "BLD1",
                      "building_id": "BLD1",
                      "path_id": "pack",
                      "planned_heads": 6,
                      "planned_rate": 50
                    }
                  }
                }
              ]
            },
            {
              "name": "PathUnderstaffed",
              "title": "Path understaffed",
              "summary": "A path's active assignments fall short of its committed planned heads.",
              "description": "Raised when the staffing-gap read model finds that a path's active\n`LaborAssignment` count is below the `plannedHeads` committed for it\non the current `ShiftPlan`. This is a **flag, not a decision**: this\nbounded context surfaces the gap and never moves anyone in response.\nRebalancing is a human call, recorded back here as a new assignment.\n\n**Site scope (ADR 0034, additive).** When the gap was requested for\none canonical site, `data.site_code` carries it and `active_heads`\ncounts only associates with an active shift at that site. When\n`site_code` is absent the gap is **unscoped** (every site together,\nthe pre-ADR-0034 behaviour): consumers MUST treat absence as\n\"unscoped\", never as a particular site.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shiftplan"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "PathUnderstaffed CloudEvent",
                "description": "CloudEvent for the staffing-gap flag on a single path.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.shiftplan.PathUnderstaffed",
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:PathUnderstaffed:v1",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Planned versus actually active heads for one path.",
                        "required": [
                          "path_id",
                          "planned_heads",
                          "active_heads"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Process path whose active assignments fall short of plan.",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "planned_heads": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Heads committed to this path on the current ShiftPlan.",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "active_heads": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Count of currently ACTIVE LaborAssignments on this path.",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "site_code": {
                            "type": "string",
                            "description": "ADDITIVE and optional (ADR 0034; the payload stays v1). The canonical Site code (the facility-layout Site code, the same identifier warehouse-planning carries as `site_id`) the gap was computed for: `active_heads` then counts only associates with an active shift at that site. Omitted when the gap was computed fleet-wide, so consumers MUST treat absence as \"unscoped\" (every site together), never as a particular site.",
                            "example": "WH1",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-37>"
                  }
                ],
                "x-parser-schema-id": "PathUnderstaffedEvent"
              },
              "examples": [
                {
                  "name": "packUnderstaffed",
                  "summary": "The pack path is planned for 5 heads but only 3 assignments are active.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "b81e5f2c-7a94-4d0e-9c33-1e7f4b6a8d05",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.shiftplan.PathUnderstaffed",
                    "subject": "pack",
                    "time": "2026-08-22T02:15:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:PathUnderstaffed:v1",
                    "data": {
                      "path_id": "pack",
                      "planned_heads": 5,
                      "active_heads": 3
                    }
                  }
                },
                {
                  "name": "packUnderstaffedAtSite",
                  "summary": "The same gap computed for site WH1 only (additive site_code).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c92f6a3d-8ba5-4e1f-8d44-2f8a5c7b9e16",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.shiftplan.PathUnderstaffed",
                    "subject": "pack",
                    "time": "2026-08-22T02:15:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:PathUnderstaffed:v1",
                    "data": {
                      "path_id": "pack",
                      "planned_heads": 5,
                      "active_heads": 2,
                      "site_code": "WH1"
                    }
                  }
                }
              ]
            },
            {
              "name": "AssociateShiftStarted",
              "title": "Associate shift started",
              "summary": "An associate's roster entry was created for the shift, with their certifications.",
              "description": "Raised by the `AssociateShift` aggregate when an associate's shift\nroster entry is created. The associate's certifications are the\nqualification gate for assignment: an associate untrained on a path\ncannot be placed on it.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "associate"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "AssociateShiftStarted CloudEvent",
                "description": "CloudEvent for the creation of an associate's shift roster entry.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.associate.AssociateShiftStarted",
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:AssociateShiftStarted:v1",
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate now on shift. The certifications held at shift\nstart are not carried on the wire; each one is published as its\nown AssociateCertified event.\n",
                        "required": [
                          "associate_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the associate starting the shift.",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-45>"
                  }
                ],
                "x-parser-schema-id": "AssociateShiftStartedEvent"
              },
              "examples": [
                {
                  "name": "associateOnShift",
                  "summary": "Associate A-1001 starts a shift.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c4d9a1b2-5e63-4f8a-b0d7-2a9c3e1f7b44",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.associate.AssociateShiftStarted",
                    "subject": "A-1001",
                    "time": "2026-08-21T22:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:AssociateShiftStarted:v1",
                    "data": {
                      "associate_id": "A-1001"
                    }
                  }
                }
              ]
            },
            {
              "name": "AssociateCertified",
              "title": "Associate certified",
              "summary": "A certification was added to an associate's roster entry.",
              "description": "Raised by the `AssociateShift` aggregate when a named qualification\n(for example `pack`, `pick` or `hazmat`) is added to an associate.\nCertifications gate assignment: `AssignLabor` rejects an associate\nwho does not hold the path's required certification.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "associate"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "AssociateCertified CloudEvent",
                "description": "CloudEvent for adding one certification to an associate.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.associate.AssociateCertified",
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:AssociateCertified:v1",
                        "x-parser-schema-id": "<anonymous-schema-52>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate and the certification granted to them.",
                        "required": [
                          "associate_id",
                          "certification"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the associate being certified.",
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "certification": {
                            "type": "string",
                            "description": "The named qualification granted, e.g. \"hazmat\".",
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-53>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-50>"
                  }
                ],
                "x-parser-schema-id": "AssociateCertifiedEvent"
              },
              "examples": [
                {
                  "name": "hazmatCertified",
                  "summary": "Associate A-1001 gains the hazmat certification mid-shift.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e2f80a3-91c4-4b56-8de1-3f5a2c9b6d18",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.associate.AssociateCertified",
                    "subject": "A-1001",
                    "time": "2026-08-22T00:40:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:AssociateCertified:v1",
                    "data": {
                      "associate_id": "A-1001",
                      "certification": "hazmat"
                    }
                  }
                }
              ]
            },
            {
              "name": "AssociateBreakStarted",
              "title": "Associate break started",
              "summary": "An associate began a logged break and is no longer assignable.",
              "description": "Raised by the `AssociateShift` aggregate when an associate begins a\nlogged break. While a break is active the associate cannot be given a\nnew `LaborAssignment` — `AssignLabor` rejects the attempt.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "associate"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "AssociateBreakStarted CloudEvent",
                "description": "CloudEvent for the start of an associate's logged break.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.associate.AssociateBreakStarted",
                        "x-parser-schema-id": "<anonymous-schema-57>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:AssociateBreakStarted:v1",
                        "x-parser-schema-id": "<anonymous-schema-58>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate who went on break.",
                        "required": [
                          "associate_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the associate starting a break.",
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-59>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-56>"
                  }
                ],
                "x-parser-schema-id": "AssociateBreakStartedEvent"
              },
              "examples": [
                {
                  "name": "breakStarted",
                  "summary": "Associate A-1001 goes on break.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1a6b4c8d-0e27-43f9-9b51-8c7d2e4a5f36",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.associate.AssociateBreakStarted",
                    "subject": "A-1001",
                    "time": "2026-08-22T01:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:AssociateBreakStarted:v1",
                    "data": {
                      "associate_id": "A-1001"
                    }
                  }
                }
              ]
            },
            {
              "name": "AssociateBreakEnded",
              "title": "Associate break ended",
              "summary": "An associate ended a logged break and is assignable again.",
              "description": "Raised by the `AssociateShift` aggregate when an associate's logged\nbreak ends. The associate becomes eligible for a new\n`LaborAssignment` again, subject to the certification gate.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "associate"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "AssociateBreakEnded CloudEvent",
                "description": "CloudEvent for the end of an associate's logged break.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.associate.AssociateBreakEnded",
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:AssociateBreakEnded:v1",
                        "x-parser-schema-id": "<anonymous-schema-63>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate who returned from break.",
                        "required": [
                          "associate_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the associate ending a break.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-64>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-61>"
                  }
                ],
                "x-parser-schema-id": "AssociateBreakEndedEvent"
              },
              "examples": [
                {
                  "name": "breakEnded",
                  "summary": "Associate A-1001 returns from break.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c0d8e19-6a3b-472c-91ef-4b8a0d6c3e57",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.associate.AssociateBreakEnded",
                    "subject": "A-1001",
                    "time": "2026-08-22T01:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:AssociateBreakEnded:v1",
                    "data": {
                      "associate_id": "A-1001"
                    }
                  }
                }
              ]
            },
            {
              "name": "AssociateShiftEnded",
              "title": "Associate shift ended",
              "summary": "An associate's shift closed, ending all of their active assignments.",
              "description": "Raised by the `AssociateShift` aggregate when an associate's shift\ncloses. Closing a shift ends every active `LaborAssignment` for that\nassociate, so downstream consumers should treat this as a terminal\nsignal for the associate's labor picture on the shift.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "associate"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "AssociateShiftEnded CloudEvent",
                "description": "CloudEvent for the close of an associate's shift.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.associate.AssociateShiftEnded",
                        "x-parser-schema-id": "<anonymous-schema-67>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:AssociateShiftEnded:v1",
                        "x-parser-schema-id": "<anonymous-schema-68>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate whose shift closed, ending all active assignments.",
                        "required": [
                          "associate_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the associate whose shift ended.",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-69>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-66>"
                  }
                ],
                "x-parser-schema-id": "AssociateShiftEndedEvent"
              },
              "examples": [
                {
                  "name": "shiftEnded",
                  "summary": "Associate A-1001 clocks out at end of shift.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "e2b7d3f4-8c15-4a6e-b09d-7f3c1a5b2d68",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.associate.AssociateShiftEnded",
                    "subject": "A-1001",
                    "time": "2026-08-22T06:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:AssociateShiftEnded:v1",
                    "data": {
                      "associate_id": "A-1001"
                    }
                  }
                }
              ]
            },
            {
              "name": "LaborAssigned",
              "title": "Labor assigned",
              "summary": "An associate was placed on a process path for an interval.",
              "description": "Raised by the `LaborAssignment` aggregate when an associate is\nassigned to a process path. The domain enforces two hard invariants\nbefore this event exists: the associate holds the path's required\ncertification, and the associate has no other ACTIVE assignment (no\ndouble-booking across paths).\n\nNote the path boundary: this places an associate on a *path*, never\non a specific task. Dispatching individual tasks belongs to\nFulfillment Execution.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "assignment"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "LaborAssigned CloudEvent",
                "description": "CloudEvent for placing an associate on a process path.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.assignment.LaborAssigned",
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:LaborAssigned:v1",
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate and the path they were assigned to.",
                        "required": [
                          "associate_id",
                          "path_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the assigned associate.",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "path_id": {
                            "type": "string",
                            "description": "Process path the associate now works, e.g. \"pack\". Never a task id.",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-71>"
                  }
                ],
                "x-parser-schema-id": "LaborAssignedEvent"
              },
              "examples": [
                {
                  "name": "assignedToPack",
                  "summary": "Associate A-1001 is assigned to the pack path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "0b3f6a29-4d71-4e8c-a25b-9e1d7c4f8a02",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.assignment.LaborAssigned",
                    "subject": "A-1001",
                    "time": "2026-08-21T22:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:LaborAssigned:v1",
                    "data": {
                      "associate_id": "A-1001",
                      "path_id": "pack"
                    }
                  }
                }
              ]
            },
            {
              "name": "LaborReassigned",
              "title": "Labor reassigned",
              "summary": "An associate's active assignment was ended in favour of another path.",
              "description": "Raised by the `LaborAssignment` aggregate when an associate's prior\nactive assignment is closed and a new one opened on a different path\n— the intra-shift move that keeps the one-ACTIVE-assignment invariant\nintact. The move is always a human call recorded here; this context\nnever decides a rebalance on its own.\n\n**Not on the integration topic.** Published only to the internal\nanalytics topic `warehouse.workforce.analytics` (dataschema\n`urn:warehouse:workforce-management:analytics:<EventName>:v1`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "assignment"
                },
                {
                  "name": "workforce-management"
                }
              ],
              "payload": {
                "title": "LaborReassigned CloudEvent",
                "description": "CloudEvent for moving an associate from one path to another.",
                "allOf": [
                  "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed type for this event.",
                        "const": "com.warehouse.wes.workforce-management.assignment.LaborReassigned",
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed dataschema for this event.",
                        "const": "urn:warehouse:workforce-management:analytics:LaborReassigned:v1",
                        "x-parser-schema-id": "<anonymous-schema-79>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The associate moved, and the paths they moved between.",
                        "required": [
                          "associate_id",
                          "from_path_id",
                          "to_path_id"
                        ],
                        "properties": {
                          "associate_id": {
                            "type": "string",
                            "description": "Identifier of the reassigned associate.",
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          },
                          "from_path_id": {
                            "type": "string",
                            "description": "Process path whose active assignment was ended.",
                            "x-parser-schema-id": "<anonymous-schema-82>"
                          },
                          "to_path_id": {
                            "type": "string",
                            "description": "Process path the associate was moved onto.",
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-77>"
                  }
                ],
                "x-parser-schema-id": "LaborReassignedEvent"
              },
              "examples": [
                {
                  "name": "movedPackToPick",
                  "summary": "Associate A-1001 is moved from pack to pick as the pick backlog grows.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "a75c1e88-3b02-4f6d-8c94-2d6b5a0f3e71",
                    "source": "/warehouse/workforce-management",
                    "type": "com.warehouse.wes.workforce-management.assignment.LaborReassigned",
                    "subject": "A-1001",
                    "time": "2026-08-22T02:20:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:workforce-management:analytics:LaborReassigned:v1",
                    "data": {
                      "associate_id": "A-1001",
                      "from_path_id": "pack",
                      "to_path_id": "pick"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.labor-performance.events": {
      "description": "labor-performance's integration topic (its ADR 0013), CONSUMED by this\nservice — not published: key and `subject` = the associate id,\n`source=/warehouse/labor-performance`. This service consumes only\n`com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded`\nand ignores every other type. The consumer is the measured-rate cache\n(`LABOR_PERFORMANCE_MODE=kafka-cache`, the `laborperformancecache`\nadapter: a per-process consumer group replays the topic's full history\nat startup, then keeps the local mean and idle-share totals current);\nthis channel mirrors labor-performance's own apis/asyncapi.yaml\nread-only.\n",
      "subscribe": {
        "operationId": "consumeLaborPerformanceEvents",
        "summary": "Keep the local measured-rate cache current for ProposePathPlan.",
        "description": "Subscribe to labor-performance's TaskPerformanceRecorded stream.\nEvery message updates the running mean of `actual_seconds` and the\nrunning idle share for its `task_type`. `efficiency_pct` is nullable\nand unused here (never coerced to 0); `idle_seconds_before` is\nnullable (\"not observed\"; such a message contributes to the actual\ntotal only). Messages are CloudEvents 1.0 structured-mode JSON\n(dataschema\n`urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1`).\nA message that is not a valid CloudEvents 1.0 event is logged at WARN\nand skipped; the cache dedupes on `id`.\n",
        "tags": [
          {
            "name": "labor-performance",
            "description": "Consumed from the labor-performance bounded context."
          }
        ],
        "message": {
          "name": "TaskPerformanceRecorded",
          "title": "Task Performance Recorded (from labor-performance, consumed)",
          "summary": "One completed task was scored against the standard active at completion time.",
          "description": "CONSUMED, not produced. Pinned by labor-performance's\n`apis/asyncapi.yaml`: type\n`com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded`,\n`source=/warehouse/labor-performance`, subject and Kafka key = the\nassociate id. `efficiency_pct` is NULL when the task could not be\nscored (a real business fact, never coerced to 0) and\n`idle_seconds_before` is NULL when no idle gap was observed; the\nmeasured-rate cache (`laborperformancecache`) updates its\nper-`task_type` running mean of `actual_seconds` and running idle\nshare from every message.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "labor-performance",
              "description": "Consumed from labor-performance."
            }
          ],
          "payload": {
            "type": "object",
            "description": "CloudEvents 1.0 envelope of labor-performance's\nTaskPerformanceRecorded, the integration payload, as consumed here\n(not composed from CloudEventBase, whose `source` is this service's\nown).\n",
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
                "enum": [
                  "1.0"
                ],
                "x-parser-schema-id": "<anonymous-schema-84>"
              },
              "id": {
                "type": "string",
                "description": "CloudEvents id; the cache's dedupe key.",
                "x-parser-schema-id": "<anonymous-schema-85>"
              },
              "source": {
                "type": "string",
                "enum": [
                  "/warehouse/labor-performance"
                ],
                "x-parser-schema-id": "<anonymous-schema-86>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                "x-parser-schema-id": "<anonymous-schema-87>"
              },
              "subject": {
                "type": "string",
                "description": "The associate id (also the Kafka key); the task id when the task could not be scored.",
                "x-parser-schema-id": "<anonymous-schema-88>"
              },
              "time": {
                "type": "string",
                "format": "date-time",
                "x-parser-schema-id": "<anonymous-schema-89>"
              },
              "datacontenttype": {
                "type": "string",
                "enum": [
                  "application/json"
                ],
                "x-parser-schema-id": "<anonymous-schema-90>"
              },
              "dataschema": {
                "type": "string",
                "description": "urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1",
                "x-parser-schema-id": "<anonymous-schema-91>"
              },
              "data": {
                "type": "object",
                "description": "Mirrors labor-performance's TaskPerformanceRecordedEventsData field-for-field.",
                "required": [
                  "task_id",
                  "task_type",
                  "actual_seconds",
                  "completed_at"
                ],
                "properties": {
                  "task_id": {
                    "type": "string",
                    "description": "fulfillment-execution's task id, an opaque foreign reference.",
                    "x-parser-schema-id": "<anonymous-schema-93>"
                  },
                  "associate_id": {
                    "type": "string",
                    "description": "The associate who completed the task; the empty string means no checked-in occupant (e.g. a robot station).",
                    "x-parser-schema-id": "<anonymous-schema-94>"
                  },
                  "task_type": {
                    "type": "string",
                    "description": "PICK, PACK, SLAM, or the empty string when the type could not be resolved.",
                    "x-parser-schema-id": "<anonymous-schema-95>"
                  },
                  "efficiency_pct": {
                    "type": "number",
                    "format": "double",
                    "nullable": true,
                    "description": "100 * standard_seconds / actual_seconds, or NULL when unscorable; never coerced to 0.",
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  },
                  "actual_seconds": {
                    "type": "integer",
                    "format": "int64",
                    "description": "The measured duration; 0 means unmeasurable.",
                    "x-parser-schema-id": "<anonymous-schema-97>"
                  },
                  "idle_seconds_before": {
                    "type": "integer",
                    "format": "int64",
                    "nullable": true,
                    "description": "The idle gap immediately before this task's claim; NULL when not observed (additive field).",
                    "x-parser-schema-id": "<anonymous-schema-98>"
                  },
                  "completed_at": {
                    "type": "string",
                    "format": "date-time",
                    "description": "When the associate finished — the business time, distinct from the CloudEvents `time`.",
                    "x-parser-schema-id": "<anonymous-schema-99>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-92>"
              }
            },
            "x-parser-schema-id": "TaskPerformanceRecordedEvent"
          },
          "examples": [
            {
              "name": "scoredPickTask",
              "summary": "A PICK task scored at 91.2% of standard after a 90s idle gap.",
              "payload": {
                "specversion": "1.0",
                "id": "7a2d5e91-3f04-4c8b-9e12-8b4a6d1c5f30",
                "source": "/warehouse/labor-performance",
                "type": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                "subject": "assoc-4471",
                "time": "2026-09-05T11:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1",
                "data": {
                  "task_id": "task-10231",
                  "associate_id": "assoc-4471",
                  "task_type": "PICK",
                  "efficiency_pct": 91.2,
                  "actual_seconds": 41,
                  "idle_seconds_before": 90,
                  "completed_at": "2026-09-05T09:30:00Z"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.process-path-management.events": {
      "description": "process-path-management's integration topic (the `Topic` constant in\n`internal/adapters/outbound/kafkacatalog/consumer.go`), CONSUMED by this\nservice, not published: key and `subject` = the path id,\n`source=/warehouse/process-path-management`. This service acts on\n`ProcessPathCreated`, `ProcessPathUpdated` and `ProcessPathDeactivated`\nand ignores every other type (`CPTScheduleChanged` included). The\nconsumer is the process-path catalogue (`PATH_CATALOGUE_SOURCE=kafka`,\nthe default; `file` is rejected at boot): a per-process, unique consumer\ngroup (prefix `workforce-management-process-path-catalogue`) replays the\ntopic's full history from the earliest offset at startup, and readiness\nwaits for that replay. Both `cmd/workforce` and `cmd/mcp` run one, so\npath ids are validated against the same catalogue. This channel mirrors\nprocess-path-management's own apis/asyncapi.yaml read-only.\n",
      "subscribe": {
        "operationId": "consumeProcessPathEvents",
        "summary": "Keep the local process-path catalogue current.",
        "description": "Upsert the path definition on Created and Updated (`path_id`,\n`match_prefix`, `required_capabilities`,\n`destination_location_role`; `direct` is decoded and discarded) and\nremove it on Deactivated. Messages are CloudEvents 1.0\nstructured-mode JSON (dataschema\n`urn:warehouse:process-path-management:events:<EventName>:v1`).\n",
        "tags": [
          {
            "name": "process-path-management",
            "description": "Consumed from the process-path-management bounded context."
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "ProcessPathCreated (from process-path-management, consumed)",
              "summary": "A process path was defined.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's\n`apis/asyncapi.yaml`: type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathCreated`,\n`source=/warehouse/process-path-management`, subject and Kafka key =\nthe path id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path-management",
                  "description": "Consumed from process-path-management."
                }
              ],
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathCreated, the\nintegration payload, as consumed here.\n",
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
                    "enum": [
                      "1.0"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-100>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-101>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-102>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "x-parser-schema-id": "<anonymous-schema-103>"
                  },
                  "subject": {
                    "type": "string",
                    "description": "The path id (also the Kafka key).",
                    "x-parser-schema-id": "<anonymous-schema-104>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-105>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-106>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "x-parser-schema-id": "<anonymous-schema-107>"
                  },
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; the producer's payload carries more (cycle_time_p95, eligibility, intake), ignored here.",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-109>"
                      },
                      "match_prefix": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-110>"
                      },
                      "direct": {
                        "type": "boolean",
                        "description": "Decoded and discarded; absent means false.",
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      },
                      "required_capabilities": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-113>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "destination_location_role": {
                        "type": "string",
                        "enum": [
                          "Drop",
                          "WorkCenter",
                          "Shipping"
                        ],
                        "description": "Omitted when the path declares none.",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-108>"
                  }
                },
                "x-parser-schema-id": "ProcessPathCreatedEvent"
              }
            },
            {
              "name": "ProcessPathUpdated",
              "title": "ProcessPathUpdated (from process-path-management, consumed)",
              "summary": "A process path definition changed.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's\n`apis/asyncapi.yaml`: type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated`,\n`source=/warehouse/process-path-management`, subject and Kafka key =\nthe path id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path-management",
                  "description": "Consumed from process-path-management."
                }
              ],
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathUpdated, the\nintegration payload, as consumed here.\n",
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
                    "enum": [
                      "1.0"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-115>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-116>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-117>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "x-parser-schema-id": "<anonymous-schema-118>"
                  },
                  "subject": {
                    "type": "string",
                    "description": "The path id (also the Kafka key).",
                    "x-parser-schema-id": "<anonymous-schema-119>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-120>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-121>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  },
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; the producer's payload carries more (cycle_time_p95, eligibility, intake), ignored here.",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "match_prefix": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      },
                      "direct": {
                        "type": "boolean",
                        "description": "Decoded and discarded; absent means false.",
                        "x-parser-schema-id": "<anonymous-schema-126>"
                      },
                      "required_capabilities": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-128>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-127>"
                      },
                      "destination_location_role": {
                        "type": "string",
                        "enum": [
                          "Drop",
                          "WorkCenter",
                          "Shipping"
                        ],
                        "description": "Omitted when the path declares none.",
                        "x-parser-schema-id": "<anonymous-schema-129>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-123>"
                  }
                },
                "x-parser-schema-id": "ProcessPathUpdatedEvent"
              }
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "ProcessPathDeactivated (from process-path-management, consumed)",
              "summary": "A process path was deactivated; it carries only the path id.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's\n`apis/asyncapi.yaml`: type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated`,\n`source=/warehouse/process-path-management`, subject and Kafka key =\nthe path id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path-management",
                  "description": "Consumed from process-path-management."
                }
              ],
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathDeactivated, the\nintegration payload, as consumed here.\n",
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
                    "enum": [
                      "1.0"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-130>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-131>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-132>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "x-parser-schema-id": "<anonymous-schema-133>"
                  },
                  "subject": {
                    "type": "string",
                    "description": "The path id (also the Kafka key).",
                    "x-parser-schema-id": "<anonymous-schema-134>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-135>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-136>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                    "x-parser-schema-id": "<anonymous-schema-137>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-138>"
                  }
                },
                "x-parser-schema-id": "ProcessPathDeactivatedEvent"
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "ShiftPlanCommitted": "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0]",
      "ShiftPlanCommittedAnalytics": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[0]",
      "ShiftPlanProposed": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[1]",
      "PathUnderstaffed": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[2]",
      "AssociateShiftStarted": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[3]",
      "AssociateCertified": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[4]",
      "AssociateBreakStarted": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[5]",
      "AssociateBreakEnded": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[6]",
      "AssociateShiftEnded": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[7]",
      "LaborAssigned": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[8]",
      "LaborReassigned": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[9]",
      "TaskPerformanceRecorded": "$ref:$.channels.warehouse.labor-performance.events.subscribe.message",
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[2]"
    },
    "schemas": {
      "CloudEventBase": "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "ShiftPlanCommittedEvent": "$ref:$.channels.warehouse.workforce.events.subscribe.message.oneOf[0].payload",
      "ShiftPlanCommittedAnalyticsEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[0].payload",
      "ShiftPlanProposedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[1].payload",
      "PathUnderstaffedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[2].payload",
      "AssociateShiftStartedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[3].payload",
      "AssociateCertifiedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[4].payload",
      "AssociateBreakStartedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[5].payload",
      "AssociateBreakEndedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[6].payload",
      "AssociateShiftEndedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[7].payload",
      "LaborAssignedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[8].payload",
      "LaborReassignedEvent": "$ref:$.channels.warehouse.workforce.analytics.subscribe.message.oneOf[9].payload",
      "TaskPerformanceRecordedEvent": "$ref:$.channels.warehouse.labor-performance.events.subscribe.message.payload",
      "ProcessPathCreatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0].payload",
      "ProcessPathUpdatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[1].payload",
      "ProcessPathDeactivatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[2].payload"
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
  