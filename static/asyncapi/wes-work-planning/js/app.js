
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "WES Work Planning & Release — Domain Events",
    "version": "1.0.0",
    "description": "Asynchronous event contract for the **Work Planning & Release** bounded\ncontext, the core domain of the WES (Warehouse Execution System)\nsubdomain. This service is the \"conductor\" of the distribution centre: it\nturns a shift's charge (volume due by each CPT) into a committed plan\n(rate x heads per process path), releases work continuously and\nwaveless-ly into per-path work pools, and performs flow balancing\n(Drum-Buffer-Rope, with CPT as the drum) from live buffer telemetry. It\nsits downstream of WMS planning/inventory and upstream of WCS equipment\ncontrol.\n\n## Message format\n\nEvery message this service produces or consumes on Kafka is a\n**CloudEvents 1.0 structured-mode** JSON document (mandatory fleet\nstandard, ADR-0027 — there is no flat envelope, no dual-write/dual-read\nand no envelope toggle): the CloudEvents context attributes and the\nevent-specific `data` payload travel together in a single JSON body, and\nevery produced Kafka message carries the header\n`content-type: application/cloudevents+json; charset=UTF-8` next to the\nW3C `traceparent`/`tracestate` headers. All of `specversion` (`1.0`),\n`id`, `source` (always `/warehouse/wes-work-planning`), `type`,\n`subject` (the aggregate instance id), `time` (domain occurred-at, UTC),\n`datacontenttype` (`application/json`) and `dataschema`\n(`urn:warehouse:wes-work-planning:<events|analytics>:<EventName>:v1`) are\nrequired. `data` is described per message below.\n\n## `type` naming convention\n\nThe CloudEvents `type` attribute follows a reverse-DNS dotted convention\nshared by every bounded context in this program:\n\n```\ncom.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>\n```\n\nAll segments are lowercase except the final PascalCase event name, which\nmatches the past-tense domain event name used in the code. For this\nservice the subdomain is `wes` and the bounded context is\n`work-planning`, so for example:\n\n```\ncom.warehouse.wes.work-planning.workunit.WorkReleased\ncom.warehouse.wes.work-planning.charge.ChargeForecastReceived\n```\n\nThe `entity` segment names the aggregate (or aggregate cluster) that\nraises the event: `charge` for the ChargeForecast aggregate, `plan` for\nShiftPlan/PathPlan, `workpool` for the WorkPool aggregate and the flow\nbalancing decisions taken against it, and `workunit` for the WorkUnit\naggregate.\n\n## Catalog completeness vs. what is actually published\n\nThis document is the **complete catalog** of the past-tense domain events\ndeclared by this bounded context (see `internal/domain/shared/events.go`),\nso that it is a usable reference for the whole domain model. Not every\ncatalogued event is emitted onto Kafka today: the outbound adapter\n(`internal/adapters/outbound/kafka/publisher.go`) only sees the events\nthat application use cases actually hand to `EventPublisher.Publish`. Any\nmessage that is not wired to the outbound adapter says so explicitly in\nits own `description`. Note also that Kafka publication is opt-in at\nruntime via the `EVENT_PUBLISHER=kafka` environment variable; with the\ndefault `EVENT_PUBLISHER=log` the same events are only written to the log\npublisher.\n\n## What this service consumes from other bounded contexts\n\nWork Planning is unusual in this program in that it is both a producer\nand a consumer of integration events. Those inbound streams are **not**\npart of this channel and are owned by their own bounded contexts; they\nare listed here only for orientation. Consumers dispatch on these exact\nCloudEvents `type` strings (never a short name or suffix match):\n\n```\ncom.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted\ncom.warehouse.wms.inventory-storage.reservation.StockReserved\ncom.warehouse.wms.inventory-storage.reservation.ReservationRevoked\ncom.warehouse.wes.fulfillment-execution.task.TaskCompleted\ncom.warehouse.wes.order-management.order.OrderAllocated\ncom.warehouse.wes.order-management.order.OrderPartiallyAllocated\ncom.warehouse.wes.process-path-management.processpath.ProcessPathCreated\ncom.warehouse.wes.process-path-management.processpath.ProcessPathUpdated\ncom.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated\n```\n\nA message that is not a valid CloudEvents 1.0 event (including the\nretired flat envelope) is dead-lettered to `<topic>.dlq` by the main\nconsumer, or skipped with a WARN log by the catalogue and analytics\nconsumers — never parsed as a legacy shape. This service also consumes\n`ShiftPlanCommitted` from workforce-management on\n`warehouse.workforce.events` (projected into the read-only\n`LaborPlanObserved` view — deliberately *not* fed into this context's own\nShiftPlan aggregate, which is a different model that happens to share the\nname), `StockReserved` and `ReservationRevoked` from inventory-storage on\n`warehouse.inventory.events` (projected into the SKU-keyed\n`UsableInventoryObserved` view), `TaskCompleted` from\nfulfillment-execution on `warehouse.fulfillment.events` (fed into the\n`RecordCompletion` use case to close the execution feedback loop), and\n`OrderAllocated`/`OrderPartiallyAllocated` from order-management on\n`warehouse.order-management.events` (fed into the existing\n`EnqueueWorkUnit` use case, once per order line — the event-choreography\nreplacement for order-management's former synchronous call to\n`POST /paths/{pathId}/work-units`; deliberately fire-and-forget, with no\nreply event published back). All consumer paths are idempotent under\nat-least-once redelivery: the CloudEvents `id` is recorded as processed\nin the SAME transaction as the event's effect (ADR-0028), so a failed\nattempt is retried and, once retries are exhausted, dead-lettered to\n`<topic>.dlq` — never acknowledged as already processed. A `TaskCompleted`\nwhose `work_unit_id` names a work unit this context never planned (e.g.\na PACK task fulfillment-execution created during rebin consolidation,\nwhich carries the order id) is a deliberate, INFO-logged skip: it is\nmarked processed and neither retried nor dead-lettered.\n",
    "contact": {
      "name": "WES Work Planning Team",
      "url": "https://warehouse-systems.internal/teams/wes-work-planning",
      "email": "wes-work-planning@warehouse-systems.internal"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0"
    }
  },
  "tags": [
    {
      "name": "work-planning",
      "description": "The Work Planning & Release bounded context — the core domain of the WES subdomain, responsible for planning the shift and releasing work."
    },
    {
      "name": "charge",
      "description": "Events raised by the ChargeForecast aggregate — the volume that must clear, bucketed by CPT."
    },
    {
      "name": "plan",
      "description": "Events raised by the ShiftPlan / PathPlan aggregates — the committed split of headcount and rate across process paths."
    },
    {
      "name": "workpool",
      "description": "Events raised by the WorkPool aggregate and by flow balancing against it — backlog telemetry, throttling and labor reassignment decisions."
    },
    {
      "name": "workunit",
      "description": "Events raised by the WorkUnit aggregate — a releasable unit of work carrying a CPT, from creation through release to completion."
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Production Kafka cluster shared by every warehouse-systems bounded context. Locally, a broker is available at localhost:9092 via ~/warehouse-systems/docker-compose.kafka.yml."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.work-planning.events": {
      "description": "The outbound topic owned by the Work Planning & Release bounded context (`cloudevents.TopicWorkPlanningEvents` in the code). Every domain event this service emits is written here as a CloudEvents 1.0 event with `dataschema` `urn:warehouse:wes-work-planning:events:<EventName>:v1`, keyed by the aggregate id (the CloudEvents `subject`: work unit id for WorkUnit events, path id otherwise).",
      "subscribe": {
        "operationId": "consumeWorkPlanningEvents",
        "summary": "Consume domain events emitted by WES Work Planning & Release.",
        "description": "Subscribe to this channel to receive every past-tense domain event raised by the Work Planning & Release bounded context. Messages are CloudEvents 1.0 structured-mode JSON. Consumers must be idempotent: delivery is at-least-once, and the CloudEvents `id` attribute is the de-duplication key. Consumers should also ignore `type` values they do not recognise, since new event types may be added to this channel without a major version bump.",
        "tags": [
          {
            "name": "work-planning"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ChargeForecastReceived",
              "title": "Charge Forecast Received",
              "summary": "A shift's charge forecast was recorded for a process path.",
              "description": "Raised by the ChargeForecast aggregate when `ReceiveChargeForecast` records the volume due for a process path, bucketed by CPT. Actively published to `warehouse.work-planning.events` by the outbound Kafka adapter; the published `data` carries only `path_id`, since the CPT buckets themselves are read back over the REST API rather than broadcast.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "charge"
                }
              ],
              "payload": {
                "title": "ChargeForecastReceived CloudEvent",
                "description": "CloudEvent envelope for a recorded charge forecast.",
                "allOf": [
                  {
                    "type": "object",
                    "title": "CloudEvent 1.0 context attributes",
                    "description": "The CloudEvents 1.0 structured-mode context attributes common to every message this service publishes (integration AND analytics topics). Every attribute below is REQUIRED in this fleet (ADR-0027); there is no other envelope.",
                    "required": [
                      "specversion",
                      "id",
                      "source",
                      "type",
                      "subject",
                      "time",
                      "datacontenttype",
                      "dataschema"
                    ],
                    "properties": {
                      "specversion": {
                        "type": "string",
                        "description": "The CloudEvents specification version. Always \"1.0\".",
                        "enum": [
                          "1.0"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-1>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "Unique identifier for this event occurrence, a UUID v4 minted once per domain event and persisted with the transactional outbox row, so a redelivery carries the same id. Combined with `source` it is the de-duplication key consumers must use for at-least-once delivery.",
                        "minLength": 1,
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "description": "The context that emitted the event. Always `/warehouse/wes-work-planning` for messages on this channel.",
                        "enum": [
                          "/warehouse/wes-work-planning"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "The event type, in the form `com.warehouse.wes.work-planning.<entity>.<EventName>`.",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "The identifier of the aggregate instance the event is about — a process path id for charge/plan/work-pool events, a work unit id for work unit events.",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "RFC3339 timestamp of when the domain event occurred, taken from the domain clock rather than from publish time.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "description": "Media type of the `data` member. Always \"application/json\".",
                        "enum": [
                          "application/json"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "Identifies the `data` payload shape: `urn:warehouse:wes-work-planning:<events|analytics>:<EventName>:v<N>`. The same occurrence carries the same `type` on both topics; the `dataschema` distinguishes the integration payload from the analytics payload.",
                        "pattern": "^urn:warehouse:wes-work-planning:(events|analytics):[A-Za-z]+:v[0-9]+$",
                        "x-parser-schema-id": "<anonymous-schema-8>"
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.charge.ChargeForecastReceived",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:ChargeForecastReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path the charge forecast was recorded for.",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "ChargeForecastReceivedEvent"
              },
              "examples": [
                {
                  "name": "chargeForecastReceived",
                  "summary": "Charge forecast recorded for the pick-to-tote path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.charge.ChargeForecastReceived",
                    "subject": "pick-to-tote",
                    "time": "2026-08-21T22:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:ChargeForecastReceived:v1",
                    "data": {
                      "path_id": "pick-to-tote"
                    }
                  }
                }
              ]
            },
            {
              "name": "ShiftPlanCommitted",
              "title": "Shift Plan Committed",
              "summary": "A path's headcount, rate and hours split was committed.",
              "description": "Raised by the ShiftPlan aggregate when `CommitShiftPlan` commits the rate x heads x hours split for a process path, after validating the invariant `plannedHeads <= installedStations`. Actively published to `warehouse.work-planning.events`; the published `data` carries only `path_id`. Beware the name collision: workforce-management publishes an unrelated `ShiftPlanCommitted` on `warehouse.workforce.events` that this service consumes into a read-only view. They are different models in different bounded contexts and must not be conflated.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "plan"
                }
              ],
              "payload": {
                "title": "ShiftPlanCommitted CloudEvent",
                "description": "CloudEvent envelope for a committed shift plan.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.plan.ShiftPlanCommitted",
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:ShiftPlanCommitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path whose plan was committed.",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-17>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-14>"
                  }
                ],
                "x-parser-schema-id": "ShiftPlanCommittedEvent"
              },
              "examples": [
                {
                  "name": "shiftPlanCommitted",
                  "summary": "Shift plan committed for the pack-singles path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.plan.ShiftPlanCommitted",
                    "subject": "pack-singles",
                    "time": "2026-08-21T22:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:ShiftPlanCommitted:v1",
                    "data": {
                      "path_id": "pack-singles"
                    }
                  }
                }
              ]
            },
            {
              "name": "WorkUnitCreated",
              "title": "Work Unit Created",
              "summary": "A new work unit was enqueued into a path's work pool.",
              "description": "Raised by the WorkUnit aggregate when `EnqueueWorkUnit` admits a new releasable unit of work (carrying its CPT) into the process path's work pool. The unit is queued, not yet released. Actively published to `warehouse.work-planning.events`; the published `data` carries `path_id` and `work_unit_id`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkUnitCreated CloudEvent",
                "description": "CloudEvent envelope for a newly enqueued work unit.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workunit.WorkUnitCreated",
                        "x-parser-schema-id": "<anonymous-schema-20>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:WorkUnitCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-21>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path whose work pool the unit was enqueued into.",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "Identifier of the newly created work unit.",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-19>"
                  }
                ],
                "x-parser-schema-id": "WorkUnitCreatedEvent"
              },
              "examples": [
                {
                  "name": "workUnitCreated",
                  "summary": "A pick task was enqueued into the pick-to-tote pool.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c25b9f83-7e64-4a19-b8d2-0f5a3c6e1b47",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkUnitCreated",
                    "subject": "wu-10231",
                    "time": "2026-08-21T22:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkUnitCreated:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "wu-10231"
                    }
                  }
                }
              ]
            },
            {
              "name": "WorkReleased",
              "title": "Work Released",
              "summary": "The release policy admitted a work unit into active work.",
              "description": "Raised by the WorkPool aggregate when `ReleaseNextWork` applies the release policy and admits the highest-priority (earliest-CPT) queued work unit into active work. This is the primary integration event of this bounded context: fulfillment-execution consumes it and turns it into a Task. Actively published to `warehouse.work-planning.events`. The outbound adapter enriches the `data` payload with the unit's `cpt` and `ref` by reading the WorkUnit repository, since the domain event itself only carries the identifiers. When the released unit carries a known SKU, the adapter also performs a synchronous read of that SKU's classification from inventory-storage (`GET /products/{sku}/classification`, see ADR-0009 in this service's ADR index) and stamps two OPTIONAL derived fields, `required_capabilities` and `fragile`, present only when there is a hint to give.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkReleased CloudEvent",
                "description": "CloudEvent envelope for a work unit admitted into active work by the release policy.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                        "x-parser-schema-id": "<anonymous-schema-26>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter, enriched from the WorkUnit repository with the unit's CPT and reference, the caller-stated gift-wrap request when one was made (see ADR-0010), and — when the released unit carries a known SKU — with derived hazmat-capability/fragile hints read once, synchronously, from inventory-storage's product classification at publish time (see ADR-0009).",
                        "required": [
                          "path_id",
                          "work_unit_id",
                          "cpt",
                          "ref"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path the work was released into.",
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "Identifier of the released work unit.",
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          },
                          "cpt": {
                            "type": "string",
                            "description": "RFC3339 Critical Pull Time of the released unit — the last moment it can be manifested and still make its truck. Empty string if the unit could not be re-read at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "ref": {
                            "type": "string",
                            "description": "Caller-supplied business reference for the unit (for example an order line). Empty string if the unit could not be re-read at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-34>"
                            },
                            "description": "OPTIONAL. Present only when the released unit's SKU is classified Hazmat in inventory-storage, in which case it contains exactly `[\"hazmat\"]`. Absent — not an empty array — when the SKU is unclassified, unknown, or the inventory-storage lookup is unavailable (PRODUCT_CLASSIFICATION_MODE=permissive, the default, or a lookup error). Consumers must treat an absent field identically to an empty array. See ADR-0009.",
                            "example": [
                              "hazmat"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "fragile": {
                            "type": "boolean",
                            "description": "OPTIONAL. Present and `true` only when the released unit's SKU is classified Fragile in inventory-storage. Absent — not `false` — when the SKU is unclassified, unknown, or the lookup is unavailable. Consumers must treat an absent field identically to `false`. See ADR-0009.",
                            "example": true,
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "gift_wrap": {
                            "type": "boolean",
                            "description": "OPTIONAL. Present and `true` only when the requester asked the warehouse to produce a gift package for this work unit, stated at enqueue time. This is a caller-supplied `WorkReleased` characteristic, not a derived product-classification hint — unlike `required_capabilities`/`fragile`, it is read straight off the `WorkUnit` and never looked up from inventory-storage (see ADR-0010). Absent — not `false` — when gift wrap was not requested. Consumers must treat an absent field identically to `false`.",
                            "example": true,
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-25>"
                  }
                ],
                "x-parser-schema-id": "WorkReleasedEvent"
              },
              "examples": [
                {
                  "name": "workReleased",
                  "summary": "A pick task was released into the pick-to-tote path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1d7e4b90-3c58-4d22-9a6f-8b1c0e5d7a23",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "wu-10231",
                    "time": "2026-08-21T22:12:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "wu-10231",
                      "cpt": "2026-08-22T02:00:00Z",
                      "ref": "order-88421-line-3"
                    }
                  }
                },
                {
                  "name": "workReleasedHazmatFragile",
                  "summary": "A pick task for a SKU classified both Hazmat and Fragile in inventory-storage was released; both optional hints are present.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2e8f5c01-4d69-4e33-a057-9c2d1f6b8354",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "wu-10232",
                    "time": "2026-08-21T22:13:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "wu-10232",
                      "cpt": "2026-08-22T02:05:00Z",
                      "ref": "order-88421-line-4",
                      "required_capabilities": [
                        "hazmat"
                      ],
                      "fragile": true
                    }
                  }
                }
              ]
            },
            {
              "name": "WorkUnitCompleted",
              "title": "Work Unit Completed",
              "summary": "A released work unit finished.",
              "description": "Raised by the WorkUnit aggregate when `RecordCompletion` marks a released unit as done — either from the REST endpoint or from a `TaskCompleted` event consumed off `warehouse.fulfillment.events`. The aggregate refuses a double-complete. Actively published to `warehouse.work-planning.events`; the published `data` carries `path_id` and `work_unit_id`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkUnitCompleted CloudEvent",
                "description": "CloudEvent envelope for a completed work unit.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workunit.WorkUnitCompleted",
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:WorkUnitCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path the completed unit belonged to.",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "Identifier of the completed work unit.",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-37>"
                  }
                ],
                "x-parser-schema-id": "WorkUnitCompletedEvent"
              },
              "examples": [
                {
                  "name": "workUnitCompleted",
                  "summary": "A pick task completed on the pick-to-tote path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6b0f2d47-1a93-4e75-8c3b-2d9e6f4a1c58",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkUnitCompleted",
                    "subject": "wu-10231",
                    "time": "2026-08-21T22:19:45Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkUnitCompleted:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "wu-10231"
                    }
                  }
                }
              ]
            },
            {
              "name": "BacklogThresholdBreached",
              "title": "Backlog Threshold Breached",
              "summary": "A path's backlog depth crossed its alarm threshold.",
              "description": "Raised by the WorkPool aggregate when `SampleBacklog` observes that the pool's backlog depth has crossed the alarm threshold — the buffer signal that drives flow balancing. Actively published to `warehouse.work-planning.events`; the published `data` carries only `path_id`. Consumers wanting the depth and rate numbers should read the telemetry projection over REST rather than infer them here.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "BacklogThresholdBreached CloudEvent",
                "description": "CloudEvent envelope for a backlog alarm threshold breach.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workpool.BacklogThresholdBreached",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:BacklogThresholdBreached:v1",
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path whose backlog crossed its alarm threshold.",
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-43>"
                  }
                ],
                "x-parser-schema-id": "BacklogThresholdBreachedEvent"
              },
              "examples": [
                {
                  "name": "backlogThresholdBreached",
                  "summary": "The pack-singles buffer went over its alarm threshold.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9c4a1e60-8b72-4d31-a5f9-7e2c3b0d6f18",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.BacklogThresholdBreached",
                    "subject": "pack-singles",
                    "time": "2026-08-21T22:25:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:BacklogThresholdBreached:v1",
                    "data": {
                      "path_id": "pack-singles"
                    }
                  }
                }
              ]
            },
            {
              "name": "RateDeviationDetected",
              "title": "Rate Deviation Detected",
              "summary": "A path's actual throughput deviated materially from plan.",
              "description": "Raised when a process path's observed throughput diverges materially from the rate committed in its PathPlan — the plan-vs-actual signal for flow balancing. **Not yet wired to the outbound Kafka adapter — documented here as part of the domain-event catalog, in-process only today.** The event type is declared in `internal/domain/shared/events.go` and the publisher's payload switch already handles it, but no application use case currently raises it, so nothing is emitted onto the topic. The example below shows the shape it would take once wired.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "RateDeviationDetected CloudEvent",
                "description": "CloudEvent envelope for a plan-vs-actual rate deviation. Catalog-only today — no use case currently raises this event.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workpool.RateDeviationDetected",
                        "x-parser-schema-id": "<anonymous-schema-49>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:RateDeviationDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload the outbound adapter's type switch would produce for this event once a use case raises it.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path whose actual rate deviated from plan.",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-48>"
                  }
                ],
                "x-parser-schema-id": "RateDeviationDetectedEvent"
              },
              "examples": [
                {
                  "name": "rateDeviationDetected",
                  "summary": "Actual rate on pick-to-tote drifted away from plan.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2e8b5c34-6f19-4a07-9d52-1c7a4e3b8f60",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.RateDeviationDetected",
                    "subject": "pick-to-tote",
                    "time": "2026-08-21T22:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:RateDeviationDetected:v1",
                    "data": {
                      "path_id": "pick-to-tote"
                    }
                  }
                }
              ]
            },
            {
              "name": "PathThrottled",
              "title": "Path Throttled",
              "summary": "Flow balancing decided to throttle upstream release into a path.",
              "description": "Raised by `RebalanceDecision` when a flow-fed pool is over its alarm threshold and the recommendation is to throttle upstream release — the rope in Drum-Buffer-Rope pulling back on a saturated buffer. Actively published to `warehouse.work-planning.events`; the published `data` carries only `path_id`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "PathThrottled CloudEvent",
                "description": "CloudEvent envelope for an upstream release throttle decision.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workpool.PathThrottled",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:PathThrottled:v1",
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path whose upstream release was throttled.",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-56>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-53>"
                  }
                ],
                "x-parser-schema-id": "PathThrottledEvent"
              },
              "examples": [
                {
                  "name": "pathThrottled",
                  "summary": "Upstream release into pack-singles was throttled.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7f3c8a25-4d16-4b93-8e07-5a2b9c1d4e73",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.PathThrottled",
                    "subject": "pack-singles",
                    "time": "2026-08-21T22:31:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:PathThrottled:v1",
                    "data": {
                      "path_id": "pack-singles"
                    }
                  }
                }
              ]
            },
            {
              "name": "LaborReassignmentFlagged",
              "title": "Labor Reassignment Flagged",
              "summary": "Flow balancing recommended moving labor to relieve a path.",
              "description": "Raised by `RebalanceDecision` when a release-fed pool is at its WIP limit with backlog still queued: releasing more work cannot help, so the recommendation is to move heads onto the path instead. Actively published to `warehouse.work-planning.events`; the published `data` carries only `path_id`. Workforce Management is the intended reader.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "LaborReassignmentFlagged CloudEvent",
                "description": "CloudEvent envelope for a labor reassignment recommendation.",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workpool.LaborReassignmentFlagged",
                        "x-parser-schema-id": "<anonymous-schema-59>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:LaborReassignmentFlagged:v1",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path labor should be moved onto.",
                            "x-parser-schema-id": "<anonymous-schema-62>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-58>"
                  }
                ],
                "x-parser-schema-id": "LaborReassignmentFlaggedEvent"
              },
              "examples": [
                {
                  "name": "laborReassignmentFlagged",
                  "summary": "Labor reassignment recommended for pick-to-tote.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3a9d7e52-0c48-4f61-b2d8-6e4c1a5b9f27",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.LaborReassignmentFlagged",
                    "subject": "pick-to-tote",
                    "time": "2026-08-21T22:33:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:LaborReassignmentFlagged:v1",
                    "data": {
                      "path_id": "pick-to-tote"
                    }
                  }
                }
              ]
            },
            {
              "name": "PathCapacityChanged",
              "title": "Path Capacity Changed",
              "summary": "This service reported a process path's remaining admission capacity for a specific CPT cutoff window.",
              "description": "Raised when `SampleBacklog` is asked (via the optional `cutoffAt` query parameter on `GET /paths/{pathId}/telemetry`, see ADR-0018) to report the path's currently remaining admission capacity, correlated against a CPT cutoff timestamp. This PUBLISHES state this service already tracks on its own `WorkPool` aggregate (`wipLimit` minus current WIP) — it introduces no new domain concept or per-CPT capacity bucket. `known` is `false` for a FlowFed path (no hard admission ceiling — only an alarm threshold, which is not a capacity figure) or a ReleaseFed path with no WIP limit provisioned; when `known` is `false`, `remaining_units` is always `0`.\n`cutoff_at` is this service's own native CPT currency (a concrete RFC3339 timestamp), not process-path-management's site-schedule `cptId` string, which this service has zero dependency on. A future order-management consumer is responsible for correlating `cutoff_at` against its own cached `CPTWindow.CutoffAt` (exact match or nearest- window match) to resolve which `cptId` this figure applies to — see ADR-0018 for the full correlation-by-timestamp design and its accepted imprecision trade-off. Actively published to `warehouse.work-planning.events`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "PathCapacityChanged CloudEvent",
                "description": "CloudEvent envelope for a reported remaining-admission-capacity figure for a process path, correlated against a CPT cutoff timestamp (see ADR-0018).",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "description": "Fixed event type for this message.",
                        "const": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                        "x-parser-schema-id": "<anonymous-schema-64>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-65>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter.",
                        "required": [
                          "path_id",
                          "cutoff_at",
                          "remaining_units",
                          "known"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Identifier of the process path this capacity figure applies to.",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "RFC3339 CPT cutoff timestamp this remaining-capacity figure applies to — this service's own native CPT currency, NOT process-path-management's site-schedule `cptId` string (see ADR-0018's correlation-by-timestamp discussion). A consumer must correlate this timestamp against its own cached CPT-window schedule to resolve which `cptId` it corresponds to.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "remaining_units": {
                            "type": "integer",
                            "format": "int32",
                            "description": "How many more units this path can admit right now (WIP limit minus current WIP; always non-negative since the aggregate never admits past its own limit). Meaningful only when `known` is `true`; always `0` when `known` is `false`.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "known": {
                            "type": "boolean",
                            "description": "`false` when this path is FlowFed (no hard admission ceiling — only a backlog alarm threshold, not a capacity figure) or when it is ReleaseFed with no WIP limit provisioned. `true` otherwise.",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-66>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-63>"
                  }
                ],
                "x-parser-schema-id": "PathCapacityChangedEvent"
              },
              "examples": [
                {
                  "name": "pathCapacityChangedKnown",
                  "summary": "pick-to-tote (ReleaseFed, WIP limit 40, WIP 23) reports 17 remaining units of admission capacity for the 02:00 UTC cutoff.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c7d3f92-1b64-4a08-9e73-2f6a8c1d5b40",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                    "subject": "pick-to-tote",
                    "time": "2026-08-21T22:40:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "cutoff_at": "2026-08-22T02:00:00Z",
                      "remaining_units": 17,
                      "known": true
                    }
                  }
                },
                {
                  "name": "pathCapacityChangedUnknownFlowFed",
                  "summary": "pack-singles is FlowFed (no hard admission ceiling), so capacity is reported as unknown rather than derived from its alarm threshold.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6d8e4a03-2c75-4b19-8f84-3a7b9d2e6c51",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                    "subject": "pack-singles",
                    "time": "2026-08-21T22:41:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                    "data": {
                      "path_id": "pack-singles",
                      "cutoff_at": "2026-08-22T03:00:00Z",
                      "remaining_units": 0,
                      "known": false
                    }
                  }
                }
              ]
            },
            {
              "name": "PathPlanDriftDetected",
              "title": "Path Plan Drift Detected",
              "summary": "This service's committed PathPlan and the labor plan Workforce Management committed for the same path disagree on planned heads.",
              "description": "Raised by ADR-0019's reconciliation when the committed `PathPlan` planned heads differ from the heads in the latest `LaborPlanObserved` for the same path. Triggered from BOTH sides' commit (our `CommitShiftPlan` and the observed `ShiftPlanCommitted` projection), over one shared comparison, so whichever side commits second raises it. It states a fact, not a verdict: `drift_heads` is signed (`observed_planned_heads - wes_planned_heads`) and carries no opinion about which plan is right. Agreeing plans raise nothing, and nothing is raised while only one side has committed. Published through the transactional outbox with the state change.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "plan"
                }
              ],
              "payload": {
                "title": "PathPlanDriftDetected CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.pathplan.PathPlanDriftDetected",
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:events:PathPlanDriftDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "wes_planned_heads",
                          "observed_planned_heads",
                          "drift_heads",
                          "observed_at"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "wes_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads on this service's committed PathPlan.",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "observed_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads in the latest LaborPlanObserved for the path.",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "drift_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Signed `observed_planned_heads - wes_planned_heads`; never zero on this event (agreeing plans raise nothing).",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "observed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Workforce's own commit timestamp, carried from LaborPlanObserved (not the detection time — that is the envelope `time`).",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-71>"
                  }
                ],
                "x-parser-schema-id": "PathPlanDriftDetectedEvent"
              },
              "examples": [
                {
                  "name": "pathPlanDriftDetected",
                  "summary": "Workforce committed 8 heads for pick-to-tote; our PathPlan has 6.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e9f5b14-3d86-4c2a-9a95-4b8c0e3f7d62",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.pathplan.PathPlanDriftDetected",
                    "subject": "pick-to-tote",
                    "time": "2026-08-21T09:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:PathPlanDriftDetected:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "wes_planned_heads": 6,
                      "observed_planned_heads": 8,
                      "drift_heads": 2,
                      "observed_at": "2026-08-21T09:00:00Z"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.wes.analytics": {
      "description": "The internal analytics topic (ADR-0011) feeding this service's own throughput data product (`cmd/wes-projector`). Same occurrences, same CloudEvents `type` per occurrence as the integration topic, but the analytics payload shape, identified by `dataschema` `urn:warehouse:wes-work-planning:analytics:<EventName>:v1` (this replaces the retired `schema_version` field). Keyed by the aggregate id (work unit id or path id), which is also the CloudEvents `subject`.",
      "subscribe": {
        "operationId": "consumeWorkPlanningAnalytics",
        "summary": "Consume the work-planning analytics stream.",
        "description": "Subscribe to receive the analytics-shaped CloudEvents for every occurrence in the throughput data product's contract. Delivery is at-least-once; the CloudEvents `id` is the de-duplication key, and unknown `type` values must be ignored.",
        "tags": [
          {
            "name": "work-planning"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ChargeForecastReceivedAnalytics",
              "title": "ChargeForecastReceived (analytics stream)",
              "summary": "Analytics-shaped ChargeForecastReceived occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "charge"
                }
              ],
              "payload": {
                "title": "ChargeForecastReceived analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.charge.ChargeForecastReceived",
                        "x-parser-schema-id": "<anonymous-schema-81>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:ChargeForecastReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-82>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-80>"
                  }
                ],
                "x-parser-schema-id": "ChargeForecastReceivedAnalyticsEvent"
              }
            },
            {
              "name": "ShiftPlanCommittedAnalytics",
              "title": "ShiftPlanCommitted (analytics stream)",
              "summary": "Analytics-shaped ShiftPlanCommitted occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "plan"
                }
              ],
              "payload": {
                "title": "ShiftPlanCommitted analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.plan.ShiftPlanCommitted",
                        "x-parser-schema-id": "<anonymous-schema-86>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:ShiftPlanCommitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-87>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-85>"
                  }
                ],
                "x-parser-schema-id": "ShiftPlanCommittedAnalyticsEvent"
              }
            },
            {
              "name": "WorkUnitCreatedAnalytics",
              "title": "WorkUnitCreated (analytics stream)",
              "summary": "Analytics-shaped WorkUnitCreated occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkUnitCreated analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workunit.WorkUnitCreated",
                        "x-parser-schema-id": "<anonymous-schema-91>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkUnitCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-92>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-93>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-90>"
                  }
                ],
                "x-parser-schema-id": "WorkUnitCreatedAnalyticsEvent"
              }
            },
            {
              "name": "WorkReleasedAnalytics",
              "title": "WorkReleased (analytics stream)",
              "summary": "Analytics-shaped WorkReleased occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkReleased analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-100>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-101>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-99>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  }
                ],
                "x-parser-schema-id": "WorkReleasedAnalyticsEvent"
              }
            },
            {
              "name": "WorkUnitCompletedAnalytics",
              "title": "WorkUnitCompleted (analytics stream)",
              "summary": "Analytics-shaped WorkUnitCompleted occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workunit"
                }
              ],
              "payload": {
                "title": "WorkUnitCompleted analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workunit.WorkUnitCompleted",
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkUnitCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-105>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-102>"
                  }
                ],
                "x-parser-schema-id": "WorkUnitCompletedAnalyticsEvent"
              }
            },
            {
              "name": "BacklogThresholdBreachedAnalytics",
              "title": "BacklogThresholdBreached (analytics stream)",
              "summary": "Analytics-shaped BacklogThresholdBreached occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "BacklogThresholdBreached analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workpool.BacklogThresholdBreached",
                        "x-parser-schema-id": "<anonymous-schema-109>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:BacklogThresholdBreached:v1",
                        "x-parser-schema-id": "<anonymous-schema-110>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-112>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-108>"
                  }
                ],
                "x-parser-schema-id": "BacklogThresholdBreachedAnalyticsEvent"
              }
            },
            {
              "name": "RateDeviationDetectedAnalytics",
              "title": "RateDeviationDetected (analytics stream)",
              "summary": "Analytics-shaped RateDeviationDetected occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "RateDeviationDetected analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workpool.RateDeviationDetected",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:RateDeviationDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-115>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-117>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-116>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-113>"
                  }
                ],
                "x-parser-schema-id": "RateDeviationDetectedAnalyticsEvent"
              }
            },
            {
              "name": "PathThrottledAnalytics",
              "title": "PathThrottled (analytics stream)",
              "summary": "Analytics-shaped PathThrottled occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "PathThrottled analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workpool.PathThrottled",
                        "x-parser-schema-id": "<anonymous-schema-119>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathThrottled:v1",
                        "x-parser-schema-id": "<anonymous-schema-120>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-122>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-121>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-118>"
                  }
                ],
                "x-parser-schema-id": "PathThrottledAnalyticsEvent"
              }
            },
            {
              "name": "LaborReassignmentFlaggedAnalytics",
              "title": "LaborReassignmentFlagged (analytics stream)",
              "summary": "Analytics-shaped LaborReassignmentFlagged occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "LaborReassignmentFlagged analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workpool.LaborReassignmentFlagged",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:LaborReassignmentFlagged:v1",
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-126>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-123>"
                  }
                ],
                "x-parser-schema-id": "LaborReassignmentFlaggedAnalyticsEvent"
              }
            },
            {
              "name": "PathCapacityChangedAnalytics",
              "title": "PathCapacityChanged (analytics stream)",
              "summary": "Analytics-shaped PathCapacityChanged occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "workpool"
                }
              ],
              "payload": {
                "title": "PathCapacityChanged analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                        "x-parser-schema-id": "<anonymous-schema-129>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathCapacityChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-130>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "cutoff_at",
                          "remaining_units",
                          "known"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          },
                          "remaining_units": {
                            "type": "integer",
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          },
                          "known": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-135>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-131>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-128>"
                  }
                ],
                "x-parser-schema-id": "PathCapacityChangedAnalyticsEvent"
              }
            },
            {
              "name": "PathPlanDriftDetectedAnalytics",
              "title": "PathPlanDriftDetected (analytics stream)",
              "summary": "Analytics-shaped PathPlanDriftDetected occurrence on warehouse.wes.analytics.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "plan"
                }
              ],
              "payload": {
                "title": "PathPlanDriftDetected analytics CloudEvent",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                        "const": "com.warehouse.wes.work-planning.pathplan.PathPlanDriftDetected",
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathPlanDriftDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-138>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id",
                          "wes_planned_heads",
                          "observed_planned_heads",
                          "drift_heads",
                          "observed_at"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          },
                          "wes_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads on this service's committed PathPlan.",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          },
                          "observed_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads in the latest LaborPlanObserved for the path.",
                            "x-parser-schema-id": "<anonymous-schema-142>"
                          },
                          "drift_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Signed `observed_planned_heads - wes_planned_heads`; never zero on this event (agreeing plans raise nothing).",
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          },
                          "observed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Workforce's own commit timestamp, carried from LaborPlanObserved (not the detection time — that is the envelope `time`).",
                            "x-parser-schema-id": "<anonymous-schema-144>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-136>"
                  }
                ],
                "x-parser-schema-id": "PathPlanDriftDetectedAnalyticsEvent"
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "ChargeForecastReceived": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0]",
      "ShiftPlanCommitted": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[1]",
      "WorkUnitCreated": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[2]",
      "WorkReleased": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[3]",
      "WorkUnitCompleted": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[4]",
      "BacklogThresholdBreached": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[5]",
      "RateDeviationDetected": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[6]",
      "PathThrottled": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[7]",
      "LaborReassignmentFlagged": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[8]",
      "PathCapacityChanged": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[9]",
      "PathPlanDriftDetected": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[10]",
      "ChargeForecastReceivedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[0]",
      "ShiftPlanCommittedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[1]",
      "WorkUnitCreatedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[2]",
      "WorkReleasedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[3]",
      "WorkUnitCompletedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[4]",
      "BacklogThresholdBreachedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[5]",
      "RateDeviationDetectedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[6]",
      "PathThrottledAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[7]",
      "LaborReassignmentFlaggedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[8]",
      "PathCapacityChangedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[9]",
      "PathPlanDriftDetectedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[10]"
    },
    "schemas": {
      "CloudEventBase": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "ChargeForecastReceivedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload",
      "ShiftPlanCommittedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[1].payload",
      "WorkUnitCreatedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[2].payload",
      "WorkReleasedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[3].payload",
      "WorkUnitCompletedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[4].payload",
      "BacklogThresholdBreachedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[5].payload",
      "RateDeviationDetectedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[6].payload",
      "PathThrottledEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[7].payload",
      "LaborReassignmentFlaggedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[8].payload",
      "PathCapacityChangedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[9].payload",
      "ChargeForecastReceivedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[0].payload",
      "ShiftPlanCommittedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[1].payload",
      "WorkUnitCreatedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[2].payload",
      "WorkReleasedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[3].payload",
      "WorkUnitCompletedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[4].payload",
      "BacklogThresholdBreachedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[5].payload",
      "RateDeviationDetectedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[6].payload",
      "PathThrottledAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[7].payload",
      "LaborReassignmentFlaggedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[8].payload",
      "PathCapacityChangedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[9].payload",
      "PathPlanDriftDetectedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[10].payload",
      "PathPlanDriftDetectedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[10].payload"
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
  