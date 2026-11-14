
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "WES Work Planning & Release — Domain Events",
    "version": "1.0.0",
    "description": "Asynchronous event contract for the **Work Planning & Release** bounded\ncontext, the core domain of the WES (Warehouse Execution System)\nsubdomain. This service is the \"conductor\" of the distribution centre: it\nturns a shift's charge (volume due by each CPT) into a committed plan\n(rate x heads per process path), releases work continuously and\nwaveless-ly into per-path work pools, and performs flow balancing\n(Drum-Buffer-Rope, with CPT as the drum) from live buffer telemetry. It\nsits downstream of WMS planning/inventory and upstream of WCS equipment\ncontrol.\n\n## Message format\n\nEvery message this service produces or consumes on Kafka is a\n**CloudEvents 1.0 structured-mode** JSON document (mandatory fleet\nstandard, ADR-0027 — there is no flat envelope, no dual-write/dual-read\nand no envelope toggle): the CloudEvents context attributes and the\nevent-specific `data` payload travel together in a single JSON body, and\nevery produced Kafka message carries the header\n`content-type: application/cloudevents+json; charset=UTF-8` next to the\nW3C `traceparent`/`tracestate` headers. All of `specversion` (`1.0`),\n`id`, `source` (always `/warehouse/wes-work-planning`), `type`,\n`subject` (the aggregate instance id), `time` (domain occurred-at, UTC),\n`datacontenttype` (`application/json`) and `dataschema`\n(`urn:warehouse:wes-work-planning:<events|analytics>:<EventName>:v1`) are\nrequired. `data` is described per message below.\n\n## `type` naming convention\n\nThe CloudEvents `type` attribute follows a reverse-DNS dotted convention\nshared by every bounded context in this program:\n\n```\ncom.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>\n```\n\nAll segments are lowercase except the final PascalCase event name, which\nmatches the past-tense domain event name used in the code. For this\nservice the subdomain is `wes` and the bounded context is\n`work-planning`, so for example:\n\n```\ncom.warehouse.wes.work-planning.workunit.WorkReleased\ncom.warehouse.wes.work-planning.charge.ChargeForecastReceived\n```\n\nThe `entity` segment names the aggregate (or aggregate cluster) that\nraises the event: `charge` for the ChargeForecast aggregate, `plan` for\nShiftPlan/PathPlan, `workpool` for the WorkPool aggregate and the flow\nbalancing decisions taken against it, and `workunit` for the WorkUnit\naggregate.\n\n## Catalog completeness vs. what is actually published\n\nThis document is the **complete catalog** of the past-tense domain events\ndeclared by this bounded context (see `internal/domain/shared/events.go`),\nso that it is a usable reference for the whole domain model. Not every\ncatalogued event is emitted onto Kafka today: the outbound adapter\n(`internal/adapters/outbound/kafka/publisher.go`) only sees the events\nthat application use cases actually hand to `EventPublisher.Publish`. Any\nmessage that is not wired to the outbound adapter says so explicitly in\nits own `description`. Every raised event is written to the transactional\noutbox in the same transaction as the aggregate change and relayed to both\nKafka topics (ADR-0014); there is no log-only publisher\n(`EVENT_PUBLISHER` accepts only `kafka`, ADR-0044).\n\n## What this service consumes from other bounded contexts\n\nWork Planning is unusual in this program in that it is both a producer\nand a consumer of integration events. Those inbound streams are **not**\npart of this channel and are owned by their own bounded contexts; they\nare listed here only for orientation. Consumers dispatch on these exact\nCloudEvents `type` strings (never a short name or suffix match):\n\n```\ncom.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted\ncom.warehouse.wms.inventory-storage.reservation.StockReserved\ncom.warehouse.wms.inventory-storage.reservation.ReservationRevoked\ncom.warehouse.wes.fulfillment-execution.task.TaskCompleted\ncom.warehouse.wes.order-management.order.OrderAllocated\ncom.warehouse.wes.order-management.order.OrderPartiallyAllocated\ncom.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased\ncom.warehouse.wms.slotting-optimization.slotplan.SlotPlanApproved\ncom.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentRequested\ncom.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentCancelled\ncom.warehouse.wms.product-master.product.ProductClassified\ncom.warehouse.wms.product-master.product.ProductPackLevelDeclared\ncom.warehouse.wms.product-master.product.ProductPackLevelRetired\ncom.warehouse.wms.product-master.product.ProductPackLevelMeasured\ncom.warehouse.wes.process-path-management.processpath.ProcessPathCreated\ncom.warehouse.wes.process-path-management.processpath.ProcessPathUpdated\ncom.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated\n```\n\nA message that is not a valid CloudEvents 1.0 event (including the\nretired flat envelope) is dead-lettered to `<topic>.dlq` by the main\nconsumer, or skipped with a WARN log by the catalogue and analytics\nconsumers — never parsed as a legacy shape. This service also consumes\n`ShiftPlanCommitted` from workforce-management on\n`warehouse.workforce.events` (projected into the read-only\n`LaborPlanObserved` view — deliberately *not* fed into this context's own\nShiftPlan aggregate, which is a different model that happens to share the\nname), `StockReserved` and `ReservationRevoked` from inventory-storage on\n`warehouse.inventory.events` (projected into the SKU-keyed\n`UsableInventoryObserved` view), `TaskCompleted` from\nfulfillment-execution on `warehouse.fulfillment.events` (fed into the\n`RecordCompletion` use case to close the execution feedback loop),\n`OrderAllocated`/`OrderPartiallyAllocated` from order-management on\n`warehouse.order-management.events` (fed into the existing\n`EnqueueWorkUnit` use case, once per order line — the event-choreography\nreplacement for order-management's former synchronous call to\n`POST /paths/{pathId}/work-units`; deliberately fire-and-forget, with no\nreply event published back), and `WorkDemandReleased` from\nnetwork-inventory-planning on\n`warehouse.network-inventory-planning.events` (fed into the existing\n`EnqueueWorkUnit` use case, one work unit per released transfer demand\nleg under the deterministic id `demand_id` — see ADR-0033; also\nfire-and-forget), and `ProductClassified` from product-master on\n`warehouse.product-master.events` (applied to this context's local\nclassification copy, version-guarded, by a dedicated consumer under\n`PRODUCT_CLASSIFICATION_CONSUMER_GROUP`; the copy is what the\n`WorkReleased` encoder reads for its hazmat/fragile hints — see\nADR-0035), `SlotPlanApproved` from slotting-optimization on\n`warehouse.slotting-optimization.events` (one `RELOCATE` work unit per\nmove on path `RELOCATE`, older plans' unreleased moves cancelled — see\nADR-0040), `ReplenishmentRequested` and `ReplenishmentCancelled` from\npick-face-replenishment on `warehouse.pick-face-replenishment.events` (one\n`REPLENISH` work unit per request on path `REPLENISH`, cancelled while\nstill Pending — see ADR-0042), and `ProductPackLevelDeclared`,\n`ProductPackLevelRetired` and `ProductPackLevelMeasured` from\nproduct-master on `warehouse.product-master.events` (applied to the local\npack-level copy under `PACK_VIEW_CONSUMER_GROUP` — see ADR-0045). All\nconsumer paths are idempotent under\nat-least-once redelivery: the CloudEvents `id` is recorded as processed\nin the SAME transaction as the event's effect (ADR-0028), so a failed\nattempt is retried and, once retries are exhausted, dead-lettered to\n`<topic>.dlq` — never acknowledged as already processed. A `TaskCompleted`\nwhose `work_unit_id` names a work unit this context never planned (e.g.\na PACK task fulfillment-execution created during rebin consolidation,\nwhich carries the order id) is a deliberate, INFO-logged skip: it is\nmarked processed and neither retried nor dead-lettered. So is a\n`TaskCompleted` with a NEW event id for a work unit that is already\ncompleted (`TaskCompletedAlreadyCompleted`, ADR-0043): a stale fact,\nmarked processed, neither retried nor dead-lettered.\n",
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
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                        "description": "The context that emitted the event: `/warehouse/wes-work-planning` for messages this service PUBLISHES; the producer's own source (e.g. `/warehouse/network-inventory-planning`) for CONSUMED messages.",
                        "pattern": "^/warehouse/[a-z0-9-]+$",
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
                        "description": "Identifies the `data` payload shape: `urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>` — this repo's own urns when PUBLISHED (wes-work-planning), the producer's urn when CONSUMED (e.g. network-inventory-planning). The same occurrence carries the same `type` on both topics; the `dataschema` distinguishes the integration payload from the analytics payload.",
                        "pattern": "^urn:warehouse:[a-z0-9-]+:(events|analytics):[A-Za-z]+:v[0-9]+$",
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
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                          },
                          "reference": {
                            "type": "string",
                            "description": "Optional (ADR-0041). The unit's originating reference as stored: the order id for order work, the demand id for transfer work, the plan id for RELOCATE work. Omitted when empty. A consumer matches it against its own aggregates and ignores a reference it does not know.",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Optional (ADR-0041). The order line number of an order-line unit (ADR-0036). Omitted when unknown. Not published on the analytics stream.",
                            "x-parser-schema-id": "<anonymous-schema-26>"
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
              "description": "Raised by the WorkPool aggregate when `ReleaseNextWork` applies the release policy and admits the highest-priority (earliest-CPT) queued work unit into active work. This is the primary integration event of this bounded context: fulfillment-execution consumes it and turns it into a Task. Actively published to `warehouse.work-planning.events`. The outbound adapter enriches the `data` payload with the unit's `cpt` and `ref` by reading the WorkUnit repository, since the domain event itself only carries the identifiers. When the released unit carries a known SKU, the adapter also reads that SKU's classification from this context's local copy of product-master's `ProductClassified` events (ADR-0035; previously a synchronous read from inventory-storage, ADR-0009) and stamps two OPTIONAL derived fields, `required_capabilities` and `fragile`, present only when there is a hint to give. It also stamps the OPTIONAL `line_no` — the order line the unit was made for, stored on the WorkUnit from the `OrderAllocated` line that created it (ADR-0036) — omitted when unknown. The same `line_no` rides on the analytics-stream `WorkReleased` (`warehouse.wes.analytics`).",
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
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Payload published by the outbound Kafka adapter, enriched from the WorkUnit repository with the unit's CPT and reference, the caller-stated gift-wrap request when one was made (see ADR-0010), and — when the released unit carries a known SKU — with derived hazmat-capability/fragile hints read once, at publish time, from the local copy of product-master's classification (see ADR-0009, ADR-0035).",
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
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "Identifier of the released work unit.",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "line_no": {
                            "type": "integer",
                            "format": "int32",
                            "minimum": 1,
                            "maximum": 2147483647,
                            "description": "OPTIONAL (ADR-0036). The 1-based order line this released unit was made for (1..2147483647, the 32-bit column limit), stored on the `WorkUnit` from the `OrderAllocated` line that created it (the same number embedded in a work-unit id of the form `<order>-line-<n>`) and read straight off it at publish time, like `ref`. Present only when known: absent — never `0` or `null` — for a unit created before this field existed, a REST-enqueued unit that gave no `lineNo`, and every transfer-referenced unit. Consumers must treat an absent field as \"line unknown\" and keep working.",
                            "example": 3,
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "cpt": {
                            "type": "string",
                            "description": "RFC3339 Critical Pull Time of the released unit — the last moment it can be manifested and still make its truck. Empty string if the unit could not be re-read at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "ref": {
                            "type": "string",
                            "description": "Caller-supplied business reference for the unit (for example an order line). Empty string if the unit could not be re-read at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-37>"
                            },
                            "description": "OPTIONAL. Present only when the released unit's SKU is classified Hazmat by product-master, in which case it contains exactly `[\"hazmat\"]`. Absent — not an empty array — when the SKU is unclassified, not yet in the local copy, or the copy is unreadable or a lookup error; the fail-open lookup never blocks a release). Consumers must treat an absent field identically to an empty array. See ADR-0009, ADR-0035.",
                            "example": [
                              "hazmat"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "fragile": {
                            "type": "boolean",
                            "description": "OPTIONAL. Present and `true` only when the released unit's SKU is classified Fragile by product-master. Absent — not `false` — when the SKU is unclassified, unknown, or the lookup is unavailable. Consumers must treat an absent field identically to `false`. See ADR-0009, ADR-0035.",
                            "example": true,
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "gift_wrap": {
                            "type": "boolean",
                            "description": "OPTIONAL. Present and `true` only when the requester asked the warehouse to produce a gift package for this work unit, stated at enqueue time. This is a caller-supplied `WorkReleased` characteristic, not a derived product-classification hint — unlike `required_capabilities`/`fragile`, it is read straight off the `WorkUnit` and never looked up from inventory-storage (see ADR-0010). Absent — not `false` — when gift wrap was not requested. Consumers must treat an absent field identically to `false`.",
                            "example": true,
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "work_kind": {
                            "type": "string",
                            "description": "OPTIONAL (ADR-0033). Present only on a transfer-referenced work unit (one enqueued from network-inventory-planning's WorkDemandReleased); names the transfer leg it executes. Its presence is the discriminator for \"this is transfer work\": every order-driven unit omits all four transfer fields, so its payload is byte-identical to before transfer support existed. Consumers must treat absent as \"not transfer work\".",
                            "enum": [
                              "TRANSFER_PICK",
                              "TRANSFER_DISPATCH",
                              "TRANSFER_ARRIVAL"
                            ],
                            "example": "TRANSFER_PICK",
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          },
                          "transfer_ref": {
                            "type": "string",
                            "description": "OPTIONAL (ADR-0033). The network transfer reference this released unit executes a leg of. Present only on a transfer-referenced unit, and only when the demand carried one.",
                            "example": "TRF-2026-042",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "OPTIONAL (ADR-0048). The site the released work happens at, published for EVERY work kind whose unit carries a site: a transfer leg's network site (ADR-0033), an order unit's fulfillment site (read from OrderAllocated / OrderPartiallyAllocated's additive site_id), a RELOCATE unit's plan site, a REPLENISH unit's request site. Absent — never an empty string — when the unit has none; consumers must treat absent as \"site unknown\".",
                            "example": "WH1",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "quantity": {
                            "type": "integer",
                            "description": "OPTIONAL (ADR-0033). Units of the SKU this transfer leg moves. Present only on a transfer-referenced unit that carried a positive quantity.",
                            "minimum": 0,
                            "example": 17,
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "relocation": {
                            "type": "object",
                            "description": "OPTIONAL (ADR-0040). Present only on a RELOCATE work unit (one planned from slotting-optimization's SlotPlanApproved): the slot-plan move it executes, exactly the object fulfillment-execution's RELOCATE task decodes (its ADR 0047). Absent on order and transfer work, whose payloads are byte-identical to before. RELOCATE work never carries `work_kind`/`transfer_ref`.",
                            "required": [
                              "plan_id",
                              "move_seq",
                              "kind",
                              "sku"
                            ],
                            "properties": {
                              "plan_id": {
                                "type": "string",
                                "description": "The approved slot plan this move belongs to.",
                                "example": "plan-3b0e8d2a",
                                "x-parser-schema-id": "<anonymous-schema-45>"
                              },
                              "move_seq": {
                                "type": "integer",
                                "minimum": 0,
                                "description": "0-based position of the move in the plan's published `moves`; always present, `0` included.",
                                "example": 1,
                                "x-parser-schema-id": "<anonymous-schema-46>"
                              },
                              "kind": {
                                "type": "string",
                                "enum": [
                                  "Relocate",
                                  "Assign",
                                  "Vacate"
                                ],
                                "example": "Relocate",
                                "x-parser-schema-id": "<anonymous-schema-47>"
                              },
                              "sku": {
                                "type": "string",
                                "example": "SKU-2",
                                "x-parser-schema-id": "<anonymous-schema-48>"
                              },
                              "from_bin": {
                                "type": "string",
                                "description": "Slot the stock leaves; absent for Assign.",
                                "example": "WH1-FWD-A02-03-01-A",
                                "x-parser-schema-id": "<anonymous-schema-49>"
                              },
                              "to_bin": {
                                "type": "string",
                                "description": "Slot the stock lands in; absent for Vacate.",
                                "example": "WH1-FWD-A01-01-02-A",
                                "x-parser-schema-id": "<anonymous-schema-50>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "replenishment": {
                            "type": "object",
                            "description": "OPTIONAL (ADR-0042). Present only on a REPLENISH work unit (one planned from pick-face-replenishment's ReplenishmentRequested, released on the `REPLENISH` path): the pick-face replenishment move it executes, exactly the object fulfillment-execution's REPLENISH task decodes (its ADR 0050). Absent on order, transfer and RELOCATE work, whose payloads are byte-identical to before. REPLENISH work never carries `relocation`, `work_kind` or `transfer_ref`. All six members are always present.",
                            "required": [
                              "request_id",
                              "sku",
                              "from_bin",
                              "to_bin",
                              "quantity",
                              "priority"
                            ],
                            "properties": {
                              "request_id": {
                                "type": "string",
                                "description": "The pick-face-replenishment request; one work unit per request id.",
                                "example": "repl-9c2f6b1e-5d3a-4e8b-a7f0-1b2c3d4e5f60",
                                "x-parser-schema-id": "<anonymous-schema-52>"
                              },
                              "sku": {
                                "type": "string",
                                "example": "SKU-2",
                                "x-parser-schema-id": "<anonymous-schema-53>"
                              },
                              "from_bin": {
                                "type": "string",
                                "description": "Reserve bin the stock leaves.",
                                "example": "WH1-RSV-A07-03-02-B",
                                "x-parser-schema-id": "<anonymous-schema-54>"
                              },
                              "to_bin": {
                                "type": "string",
                                "description": "Forward pick face the stock lands in; differs from from_bin.",
                                "example": "WH1-FWD-A01-01-02-A",
                                "x-parser-schema-id": "<anonymous-schema-55>"
                              },
                              "quantity": {
                                "type": "integer",
                                "minimum": 1,
                                "example": 6,
                                "x-parser-schema-id": "<anonymous-schema-56>"
                              },
                              "priority": {
                                "type": "string",
                                "enum": [
                                  "NORMAL",
                                  "URGENT"
                                ],
                                "description": "URGENT requests are released with a CPT of requested_at + `REPLENISHMENT_URGENT_CPT_HORIZON` (default 1h) against `REPLENISHMENT_CPT_HORIZON` (default 8h) for NORMAL, so they sit in the front band of every earliest-CPT-first queue.",
                                "example": "URGENT",
                                "x-parser-schema-id": "<anonymous-schema-57>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "pick": {
                            "type": "object",
                            "description": "OPTIONAL (ADR-0045). Present only on a `CASE_PICK` / `EACH_PICK` work unit (enqueued with `quantity`, `pickUnit` or `fromBin`). Absent on every other unit.",
                            "required": [
                              "sku",
                              "quantity",
                              "unit"
                            ],
                            "properties": {
                              "sku": {
                                "type": "string",
                                "example": "SKU-2",
                                "x-parser-schema-id": "<anonymous-schema-59>"
                              },
                              "quantity": {
                                "type": "integer",
                                "minimum": 1,
                                "description": "Quantity in eaches.",
                                "example": 36,
                                "x-parser-schema-id": "<anonymous-schema-60>"
                              },
                              "unit": {
                                "type": "string",
                                "enum": [
                                  "EACH",
                                  "CASE"
                                ],
                                "example": "CASE",
                                "x-parser-schema-id": "<anonymous-schema-61>"
                              },
                              "site_id": {
                                "type": "string",
                                "description": "OPTIONAL (ADR-0048). The site the pick happens at — the released unit's site, repeated here so a pick consumer reads one object. Absent when the unit has none.",
                                "example": "WH1",
                                "x-parser-schema-id": "<anonymous-schema-62>"
                              },
                              "from_bin": {
                                "type": "string",
                                "description": "Source bin: caller-given at enqueue, or derived at enqueue from the local slot-plan copy (the SKU's forward-pick face, ADR-0048). Absent when neither exists — the unit then completes exactly as before.",
                                "example": "BIN-A1",
                                "x-parser-schema-id": "<anonymous-schema-63>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "case_break": {
                            "type": "object",
                            "description": "OPTIONAL (ADR-0045). Present only on a `BREAK_CASE` work unit (enqueued with `caseBreak`). Absent on every other unit.",
                            "required": [
                              "lpn",
                              "sku",
                              "loose_bin",
                              "pick_task_id"
                            ],
                            "properties": {
                              "lpn": {
                                "type": "string",
                                "description": "Licence plate of the sealed case.",
                                "example": "LPN-0001",
                                "x-parser-schema-id": "<anonymous-schema-65>"
                              },
                              "sku": {
                                "type": "string",
                                "example": "SKU-2",
                                "x-parser-schema-id": "<anonymous-schema-66>"
                              },
                              "loose_bin": {
                                "type": "string",
                                "example": "LOOSE-A1",
                                "x-parser-schema-id": "<anonymous-schema-67>"
                              },
                              "pick_task_id": {
                                "type": "string",
                                "example": "task-482910",
                                "x-parser-schema-id": "<anonymous-schema-68>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-27>"
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
                  "name": "workReleasedOrderLine",
                  "summary": "The line-3 pick task of an order was released; line_no states the line explicitly (ADR-0036).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f9a6d12-5e84-4b60-8c17-0a2d4e6f8b35",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "order-88421-line-3",
                    "time": "2026-08-21T22:12:45Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "order-88421-line-3",
                      "cpt": "2026-08-22T02:00:00Z",
                      "ref": "order-88421",
                      "line_no": 3
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
                },
                {
                  "name": "workReleasedRelocate",
                  "summary": "A RELOCATE move of an approved slot plan was released (ADR-0040); fulfillment-execution turns it into a RELOCATE task.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "11111111-1111-4111-8111-111111111111",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "plan-3b0e8d2a-move-1",
                    "time": "2026-10-15T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "data": {
                      "path_id": "RELOCATE",
                      "work_unit_id": "plan-3b0e8d2a-move-1",
                      "cpt": "2026-10-16T08:00:00Z",
                      "ref": "plan-3b0e8d2a",
                      "relocation": {
                        "plan_id": "plan-3b0e8d2a",
                        "move_seq": 1,
                        "kind": "Relocate",
                        "sku": "SKU-2",
                        "from_bin": "WH1-FWD-A02-03-01-A",
                        "to_bin": "WH1-FWD-A01-01-02-A"
                      }
                    }
                  }
                },
                {
                  "name": "workReleasedReplenish",
                  "summary": "A URGENT pick-face replenishment was released on the REPLENISH path (ADR-0042); fulfillment-execution turns it into a REPLENISH task (its ADR 0050).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "11111111-1111-4111-8111-111111111111",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "replenish-repl-9c2f6b1e-5d3a-4e8b-a7f0-1b2c3d4e5f60",
                    "time": "2026-10-17T09:45:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "data": {
                      "path_id": "REPLENISH",
                      "work_unit_id": "replenish-repl-9c2f6b1e-5d3a-4e8b-a7f0-1b2c3d4e5f60",
                      "cpt": "2026-10-17T10:30:00Z",
                      "ref": "repl-9c2f6b1e-5d3a-4e8b-a7f0-1b2c3d4e5f60",
                      "replenishment": {
                        "request_id": "repl-9c2f6b1e-5d3a-4e8b-a7f0-1b2c3d4e5f60",
                        "sku": "SKU-2",
                        "from_bin": "WH1-RSV-A07-03-02-B",
                        "to_bin": "WH1-FWD-A01-01-02-A",
                        "quantity": 6,
                        "priority": "URGENT"
                      }
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:WorkUnitCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-71>"
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
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "Identifier of the completed work unit.",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-69>"
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
                        "x-parser-schema-id": "<anonymous-schema-76>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:BacklogThresholdBreached:v1",
                        "x-parser-schema-id": "<anonymous-schema-77>"
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
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-75>"
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
              "x-no-consumer-reason": "reserved, not emitted today (ADR 0020)",
              "name": "RateDeviationDetected",
              "title": "Rate Deviation Detected",
              "summary": "A path's actual throughput deviated materially from plan.",
              "description": "**Reserved: declared for a future detection rule (ADR 0020 defers it); not emitted today.** Decided 2026-10-06: kept declared, neither emitted nor removed. Re-checked 2026-10-12 (gap fix D26): no ADR defines when it is raised, so it stays reserved; the architecture fitness test TestRateDeviationDetectedStaysReserved fails if production code starts raising it without that ADR.\n\nRaised when a process path's observed throughput diverges materially from the rate committed in its PathPlan — the plan-vs-actual signal for flow balancing. **Not yet wired to the outbound Kafka adapter — documented here as part of the domain-event catalog, in-process only today.** The event type is declared in `internal/domain/shared/events.go` and the publisher's payload switch already handles it, but no application use case currently raises it, so nothing is emitted onto the topic. The example below shows the shape it would take once wired.",
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
                        "x-parser-schema-id": "<anonymous-schema-81>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:RateDeviationDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-82>"
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
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-80>"
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
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                        "x-parser-schema-id": "<anonymous-schema-86>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:PathThrottled:v1",
                        "x-parser-schema-id": "<anonymous-schema-87>"
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
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-85>"
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
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                        "x-parser-schema-id": "<anonymous-schema-91>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:LaborReassignmentFlagged:v1",
                        "x-parser-schema-id": "<anonymous-schema-92>"
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
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-93>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-90>"
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
                        "x-parser-schema-id": "<anonymous-schema-96>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "Fixed integration-payload schema id for this message.",
                        "const": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-97>"
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
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          },
                          "cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "RFC3339 CPT cutoff timestamp this remaining-capacity figure applies to — this service's own native CPT currency, NOT process-path-management's site-schedule `cptId` string (see ADR-0018's correlation-by-timestamp discussion). A consumer must correlate this timestamp against its own cached CPT-window schedule to resolve which `cptId` it corresponds to.",
                            "x-parser-schema-id": "<anonymous-schema-100>"
                          },
                          "remaining_units": {
                            "type": "integer",
                            "format": "int32",
                            "description": "How many more units this path can admit right now (WIP limit minus current WIP; always non-negative since the aggregate never admits past its own limit). Meaningful only when `known` is `true`; always `0` when `known` is `false`.",
                            "x-parser-schema-id": "<anonymous-schema-101>"
                          },
                          "known": {
                            "type": "boolean",
                            "description": "`false` when this path is FlowFed (no hard admission ceiling — only a backlog alarm threshold, not a capacity figure) or when it is ReleaseFed with no WIP limit provisioned. `true` otherwise.",
                            "x-parser-schema-id": "<anonymous-schema-102>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-95>"
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
              "x-no-consumer-reason": "published for observability; no consumer in the fleet today",
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
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:events:PathPlanDriftDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-105>"
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
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "wes_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads on this service's committed PathPlan.",
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "observed_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads in the latest LaborPlanObserved for the path.",
                            "x-parser-schema-id": "<anonymous-schema-109>"
                          },
                          "drift_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Signed `observed_planned_heads - wes_planned_heads`; never zero on this event (agreeing plans raise nothing).",
                            "x-parser-schema-id": "<anonymous-schema-110>"
                          },
                          "observed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Workforce's own commit timestamp, carried from LaborPlanObserved (not the detection time — that is the envelope `time`).",
                            "x-parser-schema-id": "<anonymous-schema-111>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-106>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-103>"
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
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:ChargeForecastReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-116>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-115>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-112>"
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
                        "x-parser-schema-id": "<anonymous-schema-118>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:ShiftPlanCommitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-119>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-121>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-120>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-117>"
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
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkUnitCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-124>"
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
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-122>"
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
                        "x-parser-schema-id": "<anonymous-schema-129>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-130>"
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
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          },
                          "line_no": {
                            "type": "integer",
                            "format": "int32",
                            "minimum": 1,
                            "maximum": 2147483647,
                            "description": "OPTIONAL (ADR-0036). The 1-based order line the released unit was made for (1..2147483647); the same value, with the same omit-when-unknown rule, as `line_no` on the integration `WorkReleased`. Absent — never `0` or `null` — when the line is unknown.",
                            "example": 3,
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-131>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-128>"
                  }
                ],
                "x-parser-schema-id": "WorkReleasedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "workReleasedAnalytics",
                  "summary": "The line-3 pick task of an order was released (analytics stream).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a6c8e10-2b3d-4f57-9a81-6c0d2e4f7b93",
                    "source": "/warehouse/wes-work-planning",
                    "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "subject": "order-88421-line-3",
                    "time": "2026-08-21T22:12:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:wes-work-planning:analytics:WorkReleased:v1",
                    "data": {
                      "path_id": "pick-to-tote",
                      "work_unit_id": "order-88421-line-3",
                      "line_no": 3
                    }
                  }
                }
              ]
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
                        "x-parser-schema-id": "<anonymous-schema-136>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:WorkUnitCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-137>"
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
                            "x-parser-schema-id": "<anonymous-schema-139>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-138>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-135>"
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
                        "x-parser-schema-id": "<anonymous-schema-142>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:BacklogThresholdBreached:v1",
                        "x-parser-schema-id": "<anonymous-schema-143>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-145>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-144>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-141>"
                  }
                ],
                "x-parser-schema-id": "BacklogThresholdBreachedAnalyticsEvent"
              }
            },
            {
              "name": "RateDeviationDetectedAnalytics",
              "title": "RateDeviationDetected (analytics stream)",
              "summary": "Analytics-shaped RateDeviationDetected occurrence on warehouse.wes.analytics.",
              "description": "Reserved: declared for a future detection rule (ADR 0020 defers it); not emitted today. No ADR defines when a rate deviation is raised, so no use case raises it (an architecture fitness test, TestRateDeviationDetectedStaysReserved, fails if production code starts to). The projector still counts it, so the report's rateDeviationDetected column is always 0 until a rule is decided.",
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
                        "x-parser-schema-id": "<anonymous-schema-147>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:RateDeviationDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-148>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-150>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-149>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-146>"
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
                        "x-parser-schema-id": "<anonymous-schema-152>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathThrottled:v1",
                        "x-parser-schema-id": "<anonymous-schema-153>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-155>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-154>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-151>"
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
                        "x-parser-schema-id": "<anonymous-schema-157>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:LaborReassignmentFlagged:v1",
                        "x-parser-schema-id": "<anonymous-schema-158>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-160>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-159>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-156>"
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
                        "x-parser-schema-id": "<anonymous-schema-162>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathCapacityChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-163>"
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
                            "x-parser-schema-id": "<anonymous-schema-165>"
                          },
                          "cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-166>"
                          },
                          "remaining_units": {
                            "type": "integer",
                            "x-parser-schema-id": "<anonymous-schema-167>"
                          },
                          "known": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-168>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-164>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-161>"
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
                        "x-parser-schema-id": "<anonymous-schema-170>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:wes-work-planning:analytics:PathPlanDriftDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-171>"
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
                            "x-parser-schema-id": "<anonymous-schema-173>"
                          },
                          "wes_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads on this service's committed PathPlan.",
                            "x-parser-schema-id": "<anonymous-schema-174>"
                          },
                          "observed_planned_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Planned heads in the latest LaborPlanObserved for the path.",
                            "x-parser-schema-id": "<anonymous-schema-175>"
                          },
                          "drift_heads": {
                            "type": "integer",
                            "format": "int32",
                            "description": "Signed `observed_planned_heads - wes_planned_heads`; never zero on this event (agreeing plans raise nothing).",
                            "x-parser-schema-id": "<anonymous-schema-176>"
                          },
                          "observed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Workforce's own commit timestamp, carried from LaborPlanObserved (not the detection time — that is the envelope `time`).",
                            "x-parser-schema-id": "<anonymous-schema-177>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-172>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-169>"
                  }
                ],
                "x-parser-schema-id": "PathPlanDriftDetectedAnalyticsEvent"
              }
            }
          ]
        }
      }
    },
    "warehouse.workforce.events": {
      "description": "workforce-management's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation). Read by the main consumer under `KAFKA_CONSUMER_GROUP` with a `warehouse.workforce.events.dlq`. Only ShiftPlanCommitted is consumed; every other type is ignored.",
      "publish": {
        "operationId": "consumeWorkforceShiftPlanCommitted",
        "summary": "Project workforce-management's ShiftPlanCommitted into the LaborPlanObserved view.",
        "description": "ObserveLaborPlan upserts the read-only `LaborPlanObserved` view keyed by `path_id` (served by `GET /paths/{pathId}/labor-plan-view`) and reconciles it against this service's own committed PathPlan, raising `PathPlanDriftDetected` on a heads mismatch (ADR-0019). It is deliberately NOT fed into this service's own ShiftPlan aggregate (ADR-0006). The CloudEvents `id` is claimed in the same transaction as the effect. A message that is not a valid CloudEvent is published raw to the DLQ without retry.",
        "message": {
          "name": "WorkforceShiftPlanCommitted",
          "title": "Shift Plan Committed (consumed)",
          "summary": "workforce-management committed a shift plan for a path.",
          "description": "CONSUMED from `warehouse.workforce.events`, read-only mirror of the producer's contract. NOT this service's own ShiftPlanCommitted (a different model in a different bounded context, ADR-0006).",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "work-planning"
            }
          ],
          "payload": {
            "title": "ShiftPlanCommitted CloudEvent (consumed)",
            "description": "Read-only mirror of workforce-management's ShiftPlanCommitted; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                    "const": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                    "x-parser-schema-id": "<anonymous-schema-179>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                    "x-parser-schema-id": "<anonymous-schema-180>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "building_id",
                      "shift_id",
                      "path_id",
                      "planned_heads",
                      "planned_rate",
                      "planned_hours"
                    ],
                    "properties": {
                      "building_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-182>"
                      },
                      "shift_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-183>"
                      },
                      "path_id": {
                        "type": "string",
                        "description": "Key of the LaborPlanObserved view.",
                        "x-parser-schema-id": "<anonymous-schema-184>"
                      },
                      "planned_heads": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-185>"
                      },
                      "planned_rate": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-186>"
                      },
                      "planned_hours": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-187>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-181>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-178>"
              }
            ],
            "x-parser-schema-id": "WorkforceShiftPlanCommittedEvent"
          },
          "examples": [
            {
              "name": "workforceShiftPlanCommitted",
              "payload": {
                "specversion": "1.0",
                "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                "source": "/warehouse/workforce-management",
                "type": "com.warehouse.wes.workforce-management.shiftplan.ShiftPlanCommitted",
                "subject": "pick-a",
                "time": "2026-10-06T09:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:workforce-management:events:ShiftPlanCommitted:v1",
                "data": {
                  "building_id": "WH1",
                  "shift_id": "shift-2026-10-06-day",
                  "path_id": "pick-a",
                  "planned_heads": 6,
                  "planned_rate": 95.5,
                  "planned_hours": 8
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation). Read by the main consumer under `KAFKA_CONSUMER_GROUP` with a `warehouse.fulfillment.events.dlq`. Only TaskCompleted is consumed.",
      "publish": {
        "operationId": "consumeTaskCompleted",
        "summary": "Close the execution feedback loop by completing the named work unit.",
        "description": "ApplyTaskCompleted wraps `RecordCompletion` for the event's `work_unit_id`. A `work_unit_id` this context never planned (for example a PACK task created during rebin consolidation, which carries the order id) is an INFO-logged, processed skip; a NEW event id for an already-completed work unit is a stale fact, marked processed (ADR-0043). Neither is retried or dead-lettered. Any other failure is retried and then dead-lettered.",
        "message": {
          "name": "TaskCompleted",
          "title": "Task Completed (consumed)",
          "summary": "fulfillment-execution finished a task.",
          "description": "CONSUMED from `warehouse.fulfillment.events`, read-only mirror of the producer's contract. Drives `RecordCompletion` for `work_unit_id`.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "work-planning"
            }
          ],
          "payload": {
            "title": "TaskCompleted CloudEvent (consumed)",
            "description": "Read-only mirror of fulfillment-execution's TaskCompleted; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                    "const": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                    "x-parser-schema-id": "<anonymous-schema-189>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                    "x-parser-schema-id": "<anonymous-schema-190>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "task_id",
                      "station_id",
                      "work_unit_id"
                    ],
                    "properties": {
                      "task_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-192>"
                      },
                      "station_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-193>"
                      },
                      "work_unit_id": {
                        "type": "string",
                        "description": "The work unit to complete.",
                        "x-parser-schema-id": "<anonymous-schema-194>"
                      },
                      "task_type": {
                        "type": "string",
                        "description": "OPTIONAL. PICK, PACK, SLAM or REBIN; read for logging only.",
                        "x-parser-schema-id": "<anonymous-schema-195>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-191>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-188>"
              }
            ],
            "x-parser-schema-id": "TaskCompletedEvent"
          },
          "examples": [
            {
              "name": "taskCompleted",
              "payload": {
                "specversion": "1.0",
                "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "subject": "task-1",
                "time": "2026-10-06T09:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "data": {
                  "task_id": "task-1",
                  "station_id": "station-7",
                  "work_unit_id": "order-77213-line-1",
                  "task_type": "PICK"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.order-management.events": {
      "description": "order-management's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation). Read by the main consumer under `KAFKA_CONSUMER_GROUP` with a `warehouse.order-management.events.dlq`. Only OrderAllocated and OrderPartiallyAllocated are consumed (identical payload shape).",
      "publish": {
        "operationId": "consumeOrderAllocated",
        "summary": "Enqueue one work unit per allocated order line.",
        "description": "ApplyOrderAllocated feeds each line into `EnqueueWorkUnit` under the deterministic id `<order_id>-line-<line_no>` (reference = order id, `lineNo` = `line_no`, ADR-0031, ADR-0036). Fire-and-forget: no reply event is published. The CloudEvents `id` is claimed in the same transaction as the enqueue; a failure is retried and then dead-lettered.",
        "message": {
          "oneOf": [
            {
              "name": "OrderAllocated",
              "title": "Order Allocated (consumed)",
              "summary": "order-management allocated an order; its lines are ready to enqueue.",
              "description": "CONSUMED from `warehouse.order-management.events`, read-only mirror of the producer's contract. One work unit is enqueued per line.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "OrderAllocated CloudEvent (consumed)",
                "description": "Read-only mirror of order-management's OrderAllocated; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                        "const": "com.warehouse.wes.order-management.order.OrderAllocated",
                        "x-parser-schema-id": "<anonymous-schema-197>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:order-management:events:OrderAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-198>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "order_id",
                          "promise_date",
                          "lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "description": "Becomes the work units' reference and the id prefix `<order_id>-line-<line_no>`.",
                            "x-parser-schema-id": "<anonymous-schema-200>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Becomes each work unit's CPT.",
                            "x-parser-schema-id": "<anonymous-schema-201>"
                          },
                          "lines": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "path_id"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-204>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-205>"
                                },
                                "path_id": {
                                  "type": "string",
                                  "description": "Validated against the process-path catalogue.",
                                  "x-parser-schema-id": "<anonymous-schema-206>"
                                },
                                "gift_wrap": {
                                  "type": "boolean",
                                  "x-parser-schema-id": "<anonymous-schema-207>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-203>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-202>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-199>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-196>"
                  }
                ],
                "x-parser-schema-id": "OrderAllocatedEvent"
              },
              "examples": [
                {
                  "name": "orderAllocated",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderAllocated",
                    "subject": "order-77213",
                    "time": "2026-10-06T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderAllocated:v1",
                    "data": {
                      "order_id": "order-77213",
                      "promise_date": "2026-10-08T00:00:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "sku-482910",
                          "path_id": "pick-a",
                          "gift_wrap": false
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderPartiallyAllocated",
              "title": "Order Partially Allocated (consumed)",
              "summary": "order-management partially allocated an order; the allocated lines are ready to enqueue.",
              "description": "CONSUMED from `warehouse.order-management.events`, read-only mirror of the producer's contract. Identical payload shape to OrderAllocated; handled identically.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "OrderPartiallyAllocated CloudEvent (consumed)",
                "description": "Read-only mirror of order-management's OrderPartiallyAllocated; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                        "const": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                        "x-parser-schema-id": "<anonymous-schema-209>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:order-management:events:OrderPartiallyAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-210>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "order_id",
                          "promise_date",
                          "lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "description": "Becomes the work units' reference and the id prefix `<order_id>-line-<line_no>`.",
                            "x-parser-schema-id": "<anonymous-schema-212>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Becomes each work unit's CPT.",
                            "x-parser-schema-id": "<anonymous-schema-213>"
                          },
                          "lines": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "path_id"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-216>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-217>"
                                },
                                "path_id": {
                                  "type": "string",
                                  "description": "Validated against the process-path catalogue.",
                                  "x-parser-schema-id": "<anonymous-schema-218>"
                                },
                                "gift_wrap": {
                                  "type": "boolean",
                                  "x-parser-schema-id": "<anonymous-schema-219>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-215>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-214>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-211>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-208>"
                  }
                ],
                "x-parser-schema-id": "OrderPartiallyAllocatedEvent"
              },
              "examples": [
                {
                  "name": "orderPartiallyAllocated",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                    "subject": "order-77213",
                    "time": "2026-10-06T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderPartiallyAllocated:v1",
                    "data": {
                      "order_id": "order-77213",
                      "promise_date": "2026-10-08T00:00:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "sku-482910",
                          "path_id": "pick-a",
                          "gift_wrap": false
                        }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.process-path-management.events": {
      "description": "process-path-management's integration topic, CONSUMED by this service only when `PATH_CATALOGUE_SOURCE=kafka` (owned by that bounded context; listed here read-only for orientation). Replayed from the earliest offset under a per-process consumer group (NOT `KAFKA_CONSUMER_GROUP`) into the in-memory process-path catalogue (ADR-0012). With the default `PATH_CATALOGUE_SOURCE=file` nothing is read from this topic.",
      "publish": {
        "operationId": "consumeProcessPathEvents",
        "summary": "Keep the process-path catalogue current.",
        "description": "ProcessPathCreated and ProcessPathUpdated upsert a path definition; ProcessPathDeactivated removes it. Invalid CloudEvents are WARN-logged and skipped; unknown types are ignored. No DLQ.",
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "Process Path Created (consumed)",
              "summary": "process-path-management created a process path.",
              "description": "CONSUMED from `warehouse.process-path-management.events` only with `PATH_CATALOGUE_SOURCE=kafka`, read-only mirror of the producer's contract.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProcessPathCreated CloudEvent (consumed)",
                "description": "Read-only mirror of process-path-management's ProcessPathCreated; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                        "x-parser-schema-id": "<anonymous-schema-221>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-222>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Same shape on all three types (ProcessPathDeactivated needs only path_id).",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-224>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-225>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Decoded and discarded.",
                            "x-parser-schema-id": "<anonymous-schema-226>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-228>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-227>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "OPTIONAL.",
                            "x-parser-schema-id": "<anonymous-schema-229>"
                          },
                          "intake": {
                            "type": "array",
                            "description": "OPTIONAL. Declared demand sources; absent decodes to none.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-231>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-230>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-223>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-220>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathCreatedEvent"
              },
              "examples": [
                {
                  "name": "processPathCreated",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "pick-a",
                    "time": "2026-10-06T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "pick-a",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [],
                      "intake": [
                        "ORDER"
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathUpdated",
              "title": "Process Path Updated (consumed)",
              "summary": "process-path-management updated a process path.",
              "description": "CONSUMED from `warehouse.process-path-management.events` only with `PATH_CATALOGUE_SOURCE=kafka`, read-only mirror of the producer's contract.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProcessPathUpdated CloudEvent (consumed)",
                "description": "Read-only mirror of process-path-management's ProcessPathUpdated; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                        "x-parser-schema-id": "<anonymous-schema-233>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-234>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Same shape on all three types (ProcessPathDeactivated needs only path_id).",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-236>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-237>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Decoded and discarded.",
                            "x-parser-schema-id": "<anonymous-schema-238>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-240>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-239>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "OPTIONAL.",
                            "x-parser-schema-id": "<anonymous-schema-241>"
                          },
                          "intake": {
                            "type": "array",
                            "description": "OPTIONAL. Declared demand sources; absent decodes to none.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-243>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-242>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-235>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-232>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathUpdatedEvent"
              },
              "examples": [
                {
                  "name": "processPathUpdated",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "subject": "pick-a",
                    "time": "2026-10-06T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                    "data": {
                      "path_id": "pick-a",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [],
                      "intake": [
                        "ORDER"
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "Process Path Deactivated (consumed)",
              "summary": "process-path-management deactivated a process path.",
              "description": "CONSUMED from `warehouse.process-path-management.events` only with `PATH_CATALOGUE_SOURCE=kafka`, read-only mirror of the producer's contract.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProcessPathDeactivated CloudEvent (consumed)",
                "description": "Read-only mirror of process-path-management's ProcessPathDeactivated; this service consumes it and never publishes it. Only the fields this service decodes are listed.",
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
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                        "x-parser-schema-id": "<anonymous-schema-245>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                        "x-parser-schema-id": "<anonymous-schema-246>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Same shape on all three types (ProcessPathDeactivated needs only path_id).",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-248>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-249>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Decoded and discarded.",
                            "x-parser-schema-id": "<anonymous-schema-250>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-252>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-251>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "OPTIONAL.",
                            "x-parser-schema-id": "<anonymous-schema-253>"
                          },
                          "intake": {
                            "type": "array",
                            "description": "OPTIONAL. Declared demand sources; absent decodes to none.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-255>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-254>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-247>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-244>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathDeactivatedEvent"
              },
              "examples": [
                {
                  "name": "processPathDeactivated",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "subject": "pick-a",
                    "time": "2026-10-06T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                    "data": {
                      "path_id": "pick-a",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [],
                      "intake": [
                        "ORDER"
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.network-inventory-planning.events": {
      "description": "network-inventory-planning's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation, mirroring its own apis/asyncapi.yaml). This service consumes only WorkDemandReleased and ignores every other type.",
      "publish": {
        "operationId": "consumeWorkDemandReleased",
        "summary": "Consume network-inventory-planning's released transfer work demands.",
        "description": "Subscribe to receive WorkDemandReleased — one leg of an approved inter-site transfer that the network has released for warehouse execution. Messages are CloudEvents 1.0 structured-mode JSON (dataschema `urn:warehouse:network-inventory-planning:events:WorkDemandReleased:v1`) keyed by demand_id. Each demand is fed into ApplyWorkDemandReleased and becomes exactly one work unit under the deterministic id `demand_id` (ADR-0033), so redelivery is idempotent. An unknown `path_id` or `work_kind` fails loud and is dead-lettered to `<topic>.dlq`.",
        "message": {
          "name": "WorkDemandReleased",
          "title": "Work Demand Released (consumed)",
          "summary": "network-inventory-planning released a transfer work demand leg.",
          "description": "CONSUMED from `warehouse.network-inventory-planning.events` — this entry mirrors the producer's own contract read-only and is NOT published by this service. One occurrence = one released transfer demand leg. `ApplyWorkDemandReleased` validates `path_id` against the process-path catalogue and `work_kind` against the declared enum, then enqueues exactly one work unit with the deterministic id `demand_id` and `ref` = `demand_id` (ADR-0033). Redelivery of the same CloudEvents `id`, or a different event carrying a `demand_id` already in a pool, is a benign no-op.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "work-planning"
            }
          ],
          "payload": {
            "title": "WorkDemandReleased CloudEvent (consumed)",
            "description": "CloudEvent envelope of network-inventory-planning's released transfer work demand, mirrored read-only from the producer's own contract. This service consumes it; it never publishes it.",
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
                    "description": "Fixed event type (the producer's own).",
                    "const": "com.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased",
                    "x-parser-schema-id": "<anonymous-schema-257>"
                  },
                  "dataschema": {
                    "type": "string",
                    "description": "The producer's payload schema id. Overrides CloudEventBase's pattern (which only admits THIS repo's own urns): a consumed event carries the PRODUCER's urn.",
                    "const": "urn:warehouse:network-inventory-planning:events:WorkDemandReleased:v1",
                    "x-parser-schema-id": "<anonymous-schema-258>"
                  },
                  "data": {
                    "type": "object",
                    "description": "One released transfer demand leg. Every field is required by the producer; this service validates path_id against its process-path catalogue and work_kind against the declared enum before enqueueing the work unit.",
                    "required": [
                      "demand_id",
                      "work_kind",
                      "transfer_ref",
                      "path_id",
                      "site_id",
                      "cpt"
                    ],
                    "properties": {
                      "demand_id": {
                        "type": "string",
                        "description": "Identity of the work demand. Becomes the deterministic work_unit_id (and the generic operator `ref`) of the enqueued work unit.",
                        "x-parser-schema-id": "<anonymous-schema-260>"
                      },
                      "work_kind": {
                        "type": "string",
                        "description": "Which leg of the transfer this demand executes.",
                        "enum": [
                          "TRANSFER_PICK",
                          "TRANSFER_DISPATCH",
                          "TRANSFER_ARRIVAL"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-261>"
                      },
                      "transfer_ref": {
                        "type": "string",
                        "description": "The network transfer this demand belongs to.",
                        "x-parser-schema-id": "<anonymous-schema-262>"
                      },
                      "path_id": {
                        "type": "string",
                        "description": "Process path the demand's work executes on (validated against this service's process-path catalogue).",
                        "x-parser-schema-id": "<anonymous-schema-263>"
                      },
                      "site_id": {
                        "type": "string",
                        "description": "Network site anchoring the leg — origin for pick/dispatch, destination for arrival.",
                        "x-parser-schema-id": "<anonymous-schema-264>"
                      },
                      "cpt": {
                        "type": "string",
                        "description": "RFC3339 Critical Pull Time carried by the demand.",
                        "x-parser-schema-id": "<anonymous-schema-265>"
                      },
                      "sku": {
                        "type": "string",
                        "description": "OPTIONAL. SKU the demand moves, when known.",
                        "x-parser-schema-id": "<anonymous-schema-266>"
                      },
                      "quantity": {
                        "type": "integer",
                        "description": "OPTIONAL. Units of the SKU the leg moves.",
                        "minimum": 0,
                        "x-parser-schema-id": "<anonymous-schema-267>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-259>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-256>"
              }
            ],
            "x-parser-schema-id": "WorkDemandReleasedEvent"
          },
          "examples": [
            {
              "name": "workDemandReleased",
              "summary": "A transfer pick leg was released for execution.",
              "payload": {
                "specversion": "1.0",
                "id": "5a1e8d42-9c47-4b58-a1f6-3d8b9e0c4a71",
                "source": "/warehouse/network-inventory-planning",
                "type": "com.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased",
                "subject": "demand-55601",
                "time": "2026-10-06T09:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:network-inventory-planning:events:WorkDemandReleased:v1",
                "data": {
                  "demand_id": "demand-55601",
                  "work_kind": "TRANSFER_PICK",
                  "transfer_ref": "TRF-2026-042",
                  "path_id": "pick-transfer-a",
                  "site_id": "site-north-1",
                  "cpt": "2026-10-06T23:00:00Z",
                  "sku": "SKU-T1",
                  "quantity": 17
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.slotting-optimization.events": {
      "description": "slotting-optimization's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation, mirroring its own apis/asyncapi.yaml). Key = the plan id. This service consumes only SlotPlanApproved and ignores SlotPlanGenerated, SlotPlanRejected and every other type (ADR-0040).",
      "publish": {
        "operationId": "consumeSlotPlanApproved",
        "summary": "Consume approved slot plans and plan their moves as RELOCATE work.",
        "description": "Read under the shared consumer group with its own `warehouse.slotting-optimization.events.dlq`. Each SlotPlanApproved becomes one RELOCATE work unit per move (id `<plan_id>-move-<seq>`, seq = 0-based position in `moves`, ref = plan_id, path RELOCATE whose catalogue intake must admit SLOT_RELOCATION). A move into a slot that another move of the same plan vacates is held out of the pool until that move's unit completes. A newer approved plan for the same site cancels the older plan's not-yet-released units; released work runs to completion; an older or duplicate plan is a no-op. The CloudEvents `id` is claimed in the same transaction (redelivery is a no-op). A malformed plan, an unknown move kind or an intake without SLOT_RELOCATION is retried and then dead-lettered; a message interrupted by shutdown is never dead-lettered.",
        "message": {
          "name": "SlotPlanApproved",
          "title": "Slot Plan Approved (consumed)",
          "summary": "slotting-optimization approved a slot plan for a site.",
          "description": "CONSUMED from `warehouse.slotting-optimization.events` — this entry mirrors the producer's own contract (SlotPlanApprovedEvent) read-only and is NOT published by this service. Only `plan_id`, `site_id`, `approved_at`, `supersedes_plan_id` and `moves` are read; `assignments` is ignored (ADR-0040).",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "work-planning"
            }
          ],
          "payload": {
            "title": "SlotPlanApproved CloudEvent (consumed)",
            "description": "Mirror of slotting-optimization's SlotPlanApprovedEvent (read-only).",
            "allOf": [
              "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "required": [
                  "type",
                  "data"
                ],
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.slotting-optimization.slotplan.SlotPlanApproved",
                    "x-parser-schema-id": "<anonymous-schema-269>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:slotting-optimization:events:SlotPlanApproved:v1",
                    "x-parser-schema-id": "<anonymous-schema-270>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "plan_id",
                      "site_id",
                      "approved_at",
                      "moves"
                    ],
                    "properties": {
                      "plan_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-272>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-273>"
                      },
                      "approved_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-274>"
                      },
                      "supersedes_plan_id": {
                        "type": "string",
                        "description": "OPTIONAL. The plan this one replaces.",
                        "x-parser-schema-id": "<anonymous-schema-275>"
                      },
                      "assignments": {
                        "type": "array",
                        "description": "Full forward map; ignored by this service.",
                        "items": {
                          "type": "object",
                          "x-parser-schema-id": "<anonymous-schema-277>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-276>"
                      },
                      "moves": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "required": [
                            "sku",
                            "kind"
                          ],
                          "properties": {
                            "sku": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-280>"
                            },
                            "from_slot": {
                              "type": "string",
                              "description": "Absent for Assign.",
                              "x-parser-schema-id": "<anonymous-schema-281>"
                            },
                            "to_slot": {
                              "type": "string",
                              "description": "Absent for Vacate.",
                              "x-parser-schema-id": "<anonymous-schema-282>"
                            },
                            "kind": {
                              "type": "string",
                              "enum": [
                                "Assign",
                                "Relocate",
                                "Vacate"
                              ],
                              "x-parser-schema-id": "<anonymous-schema-283>"
                            }
                          },
                          "x-parser-schema-id": "<anonymous-schema-279>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-278>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-271>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-268>"
              }
            ],
            "x-parser-schema-id": "SlotPlanApprovedEvent"
          },
          "examples": [
            {
              "name": "slotPlanApproved",
              "summary": "A plan with one Assign, one Relocate and one Vacate.",
              "payload": {
                "specversion": "1.0",
                "id": "0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d",
                "source": "/warehouse/slotting-optimization",
                "type": "com.warehouse.wms.slotting-optimization.slotplan.SlotPlanApproved",
                "subject": "plan-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                "time": "2026-10-08T12:30:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:slotting-optimization:events:SlotPlanApproved:v1",
                "data": {
                  "plan_id": "plan-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                  "site_id": "SITE-1",
                  "approved_at": "2026-10-08T12:30:00Z",
                  "supersedes_plan_id": "plan-8e7d6c5b-4a39-4281-b0c9-d8e7f6a5b4c3",
                  "assignments": [
                    {
                      "sku": "SKU-1",
                      "slot": "WH1-FWD-A01-01-01-A"
                    }
                  ],
                  "moves": [
                    {
                      "sku": "SKU-1",
                      "to_slot": "WH1-FWD-A01-01-01-A",
                      "kind": "Assign"
                    },
                    {
                      "sku": "SKU-2",
                      "from_slot": "WH1-FWD-A02-03-01-A",
                      "to_slot": "WH1-FWD-A01-01-02-A",
                      "kind": "Relocate"
                    },
                    {
                      "sku": "SKU-3",
                      "from_slot": "WH1-FWD-A01-01-03-A",
                      "kind": "Vacate"
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.pick-face-replenishment.events": {
      "description": "pick-face-replenishment's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation, mirroring its own apis/asyncapi.yaml). Key = the request id. This service consumes only ReplenishmentRequested and ReplenishmentCancelled and ignores ReplenishmentCompleted and every other type (ADR-0042).",
      "publish": {
        "operationId": "consumeReplenishmentEvents",
        "summary": "Consume replenishment requests and plan them as REPLENISH work.",
        "description": "A dedicated consumer reads this topic under the stable consumer group `REPLENISHMENT_CONSUMER_GROUP` (`REPLENISHMENT_MODE` unset or `kafka`; `permissive`/`off` are boot errors, ADR-0044) with its own `warehouse.pick-face-replenishment.events.dlq`. Each ReplenishmentRequested becomes exactly ONE REPLENISH work unit (id `replenish-<request_id>`, ref = request_id, path REPLENISH, released with the additive `replenishment` object of WorkReleased); a redelivery of the same CloudEvents `id`, or a second DIFFERENT event for an already-planned request id, is a no-op. ReplenishmentCancelled cancels the request's unit only while it is still Pending (not yet released); released or completed work runs to completion, and a cancellation for an unknown request is a no-op. The CloudEvents `id` is claimed in the same transaction as the effect. Invalid CloudEvents (including the retired flat envelope) are WARN-logged and skipped; a payload that can never be applied is dead-lettered at once, any other failure is retried and then dead-lettered; a message interrupted by shutdown is never dead-lettered, and the offset is committed only after success.",
        "message": {
          "oneOf": [
            {
              "name": "ReplenishmentRequested",
              "title": "Replenishment Requested (consumed)",
              "summary": "pick-face-replenishment asked for stock to be moved to a forward pick face.",
              "description": "CONSUMED from `warehouse.pick-face-replenishment.events` — this entry mirrors the producer's own contract (ReplenishmentRequestedEvent) read-only and is NOT published by this service. `request_id`, `site_id`, `sku`, `source_bin` (the reserve bin, becomes `from_bin`), `forward_bin` (the pick face, becomes `to_bin`), `quantity`, `priority` and `requested_at` are read; `policy_min` and `policy_max` are ignored (ADR-0042).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ReplenishmentRequested CloudEvent (consumed)",
                "description": "Mirror of pick-face-replenishment's ReplenishmentRequestedEvent (read-only).",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentRequested",
                        "x-parser-schema-id": "<anonymous-schema-285>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:pick-face-replenishment:events:ReplenishmentRequested:v1",
                        "x-parser-schema-id": "<anonymous-schema-286>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "request_id",
                          "site_id",
                          "sku",
                          "forward_bin",
                          "source_bin",
                          "quantity",
                          "priority",
                          "requested_at"
                        ],
                        "properties": {
                          "request_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-288>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-289>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-290>"
                          },
                          "forward_bin": {
                            "type": "string",
                            "description": "The pick face to fill; becomes the work unit's `to_bin`.",
                            "x-parser-schema-id": "<anonymous-schema-291>"
                          },
                          "source_bin": {
                            "type": "string",
                            "description": "The reserve bin the stock comes from; becomes `from_bin`.",
                            "x-parser-schema-id": "<anonymous-schema-292>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-293>"
                          },
                          "priority": {
                            "type": "string",
                            "enum": [
                              "NORMAL",
                              "URGENT"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-294>"
                          },
                          "policy_min": {
                            "type": "integer",
                            "description": "Ignored by this service.",
                            "x-parser-schema-id": "<anonymous-schema-295>"
                          },
                          "policy_max": {
                            "type": "integer",
                            "description": "Ignored by this service.",
                            "x-parser-schema-id": "<anonymous-schema-296>"
                          },
                          "requested_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-297>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-287>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-284>"
                  }
                ],
                "x-parser-schema-id": "ReplenishmentRequestedEvent"
              },
              "examples": [
                {
                  "name": "replenishmentRequested",
                  "summary": "24 units of SKU-1 from a reserve bin to its forward bin.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e5f",
                    "source": "/warehouse/pick-face-replenishment",
                    "type": "com.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentRequested",
                    "subject": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                    "time": "2026-10-17T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:pick-face-replenishment:events:ReplenishmentRequested:v1",
                    "data": {
                      "request_id": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                      "site_id": "WH1",
                      "sku": "SKU-1",
                      "forward_bin": "WH1-FWD-A01-01-01-A",
                      "source_bin": "WH1-RSV-A07-03-02-B",
                      "quantity": 24,
                      "priority": "NORMAL",
                      "policy_min": 10,
                      "policy_max": 60,
                      "requested_at": "2026-10-17T09:30:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReplenishmentCancelled",
              "title": "Replenishment Cancelled (consumed)",
              "summary": "pick-face-replenishment cancelled an open replenishment request.",
              "description": "CONSUMED from `warehouse.pick-face-replenishment.events` — this entry mirrors the producer's own contract (ReplenishmentCancelledEvent) read-only and is NOT published by this service. Only `request_id` is needed to find the unit; `reason` is carried for logs (ADR-0042).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ReplenishmentCancelled CloudEvent (consumed)",
                "description": "Mirror of pick-face-replenishment's ReplenishmentCancelledEvent (read-only).",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentCancelled",
                        "x-parser-schema-id": "<anonymous-schema-299>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:pick-face-replenishment:events:ReplenishmentCancelled:v1",
                        "x-parser-schema-id": "<anonymous-schema-300>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "request_id",
                          "reason"
                        ],
                        "properties": {
                          "request_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-302>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Ignored by this service.",
                            "x-parser-schema-id": "<anonymous-schema-303>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "Ignored by this service.",
                            "x-parser-schema-id": "<anonymous-schema-304>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "OPERATOR",
                              "ASSIGNMENT_CHANGED",
                              "POLICY_REMOVED"
                            ],
                            "description": "Carried for logs only.",
                            "x-parser-schema-id": "<anonymous-schema-305>"
                          },
                          "cancelled_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-306>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-301>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-298>"
                  }
                ],
                "x-parser-schema-id": "ReplenishmentCancelledEvent"
              },
              "examples": [
                {
                  "name": "replenishmentCancelled",
                  "summary": "Cancelled because the slot plan moved the SKU to another forward bin.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a",
                    "source": "/warehouse/pick-face-replenishment",
                    "type": "com.warehouse.wms.pick-face-replenishment.replenishment.ReplenishmentCancelled",
                    "subject": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                    "time": "2026-10-17T09:50:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:pick-face-replenishment:events:ReplenishmentCancelled:v1",
                    "data": {
                      "request_id": "repl-3b0e8d2a-7c41-4f6a-9d15-2a8b6c4e1f07",
                      "site_id": "WH1",
                      "sku": "SKU-1",
                      "reason": "ASSIGNMENT_CHANGED",
                      "cancelled_at": "2026-10-17T09:50:00Z"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.product-master.events": {
      "description": "product-master's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation, mirroring its own apis/asyncapi.yaml). Key = the SKU. This service consumes only ProductClassified (ADR-0035) and the pack-level types ProductPackLevelDeclared, ProductPackLevelRetired and ProductPackLevelMeasured into the local PackView (ADR-0045), and ignores every other type on the topic (ProductRegistered, ProductDescriptionChanged, ProductDimensionsDeclared, ProductMeasured). A second consumer reads this topic under the STABLE `PACK_VIEW_CONSUMER_GROUP` (mandatory; it must differ from `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`, because a group that already committed past the pack events could never replay them).",
      "publish": {
        "operationId": "consumeProductClassified",
        "summary": "Consume product-master's ProductClassified into the local classification copy.",
        "description": "A dedicated consumer reads this topic under the stable consumer group `PRODUCT_CLASSIFICATION_CONSUMER_GROUP` (only with `PRODUCT_CLASSIFICATION_MODE=kafka`) and keeps one row per SKU in `product_classification_copy`. It claims the CloudEvents `id` and applies the classification in ONE transaction, overwriting a stored row only when the incoming `version` is greater (an equal or older version is a no-op). Invalid CloudEvents and invalid payloads are WARN-logged and skipped; transient failures retry the same message and the offset is committed only after success.",
        "message": {
          "oneOf": [
            {
              "name": "ProductClassified",
              "title": "Product Classified (consumed)",
              "summary": "product-master set or replaced a SKU's handling classification.",
              "description": "CONSUMED from `warehouse.product-master.events` — this entry mirrors the producer's own contract read-only and is NOT published by this service. A full-state replacement of one SKU's classification at the producer's aggregate `version`; `temperature_class` and `dot_hazard_class` are omitted when unset. Applied to the local `product_classification_copy` only when `version` is greater than the stored one (ADR-0035); `classification_source` is ignored. The `WorkReleased` encoder maps `Hazmat` to `required_capabilities: [\"hazmat\"]` and `Fragile` to `fragile: true`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProductClassified CloudEvent (consumed)",
                "description": "CloudEvent envelope of product-master's ProductClassified, mirrored read-only from the producer's own contract. This service consumes it; it never publishes it.",
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
                        "description": "Fixed event type (the producer's own).",
                        "const": "com.warehouse.wms.product-master.product.ProductClassified",
                        "x-parser-schema-id": "<anonymous-schema-308>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "The producer's payload schema id. Overrides CloudEventBase's pattern (which only admits THIS repo's own urns): a consumed event carries the PRODUCER's urn.",
                        "const": "urn:warehouse:product-master:events:ProductClassified:v1",
                        "x-parser-schema-id": "<anonymous-schema-309>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Full-state replacement of the SKU's classification. This service requires `sku` and a `version` of at least 1 and skips (WARN) anything else.",
                        "required": [
                          "sku",
                          "handling_tags",
                          "classification_source",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The classified SKU (also the Kafka key and the CloudEvents subject).",
                            "x-parser-schema-id": "<anonymous-schema-311>"
                          },
                          "handling_tags": {
                            "type": "array",
                            "minItems": 1,
                            "description": "Handling tags in stable order.",
                            "items": {
                              "type": "string",
                              "enum": [
                                "Hazmat",
                                "Fragile",
                                "TemperatureSensitive",
                                "Oversized",
                                "HighValue"
                              ],
                              "x-parser-schema-id": "<anonymous-schema-313>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-312>"
                          },
                          "temperature_class": {
                            "type": "string",
                            "description": "OPTIONAL. Present only with TemperatureSensitive.",
                            "enum": [
                              "Ambient",
                              "Chilled",
                              "Frozen"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-314>"
                          },
                          "dot_hazard_class": {
                            "type": "integer",
                            "description": "OPTIONAL. Present only with Hazmat. Stored, not surfaced.",
                            "minimum": 1,
                            "maximum": 9,
                            "x-parser-schema-id": "<anonymous-schema-315>"
                          },
                          "classification_source": {
                            "type": "string",
                            "description": "Migration artefact of the producer; ignored here.",
                            "enum": [
                              "native",
                              "legacy-import"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-316>"
                          },
                          "version": {
                            "type": "integer",
                            "description": "The producer's aggregate version after the change. The local copy applies a message only when this is greater than the stored version.",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-317>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-310>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-307>"
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
              "name": "ProductPackLevelDeclared",
              "title": "ProductPackLevelDeclared (consumed)",
              "summary": "product-master declared or revised a pack level of a SKU.",
              "description": "CONSUMED from `warehouse.product-master.events` - this entry mirrors the producer's own contract read-only and is NOT published by this service. Feeds the local PackView (ADR-0045) under the stable `PACK_VIEW_CONSUMER_GROUP`. Payload pinned by product-master's `apis/asyncapi.yaml` on `develop`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProductPackLevelDeclared CloudEvent (consumed)",
                "description": "CloudEvent envelope of product-master's ProductPackLevelDeclared, mirrored read-only from the producer's own contract. This service consumes it (ADR-0045); it never publishes it.",
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
                        "const": "com.warehouse.wms.product-master.product.ProductPackLevelDeclared",
                        "x-parser-schema-id": "<anonymous-schema-319>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:product-master:events:ProductPackLevelDeclared:v1",
                        "x-parser-schema-id": "<anonymous-schema-320>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "level",
                          "gtin",
                          "units_per_pack",
                          "is_orderable",
                          "is_despatch_unit",
                          "effective_from",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-322>"
                          },
                          "level": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-323>"
                          },
                          "gtin": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-324>"
                          },
                          "child_gtin": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-325>"
                          },
                          "qty_of_child": {
                            "type": "integer",
                            "minimum": 2,
                            "description": "Absent for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-326>"
                          },
                          "units_per_pack": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Direct factor to eaches; 1 for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-327>"
                          },
                          "is_orderable": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-328>"
                          },
                          "is_despatch_unit": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-329>"
                          },
                          "effective_from": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-330>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-331>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-321>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-318>"
                  }
                ],
                "x-parser-schema-id": "ProductPackLevelDeclaredEvent"
              }
            },
            {
              "name": "ProductPackLevelRetired",
              "title": "ProductPackLevelRetired (consumed)",
              "summary": "product-master retired a pack level of a SKU.",
              "description": "CONSUMED from `warehouse.product-master.events` - this entry mirrors the producer's own contract read-only and is NOT published by this service. Feeds the local PackView (ADR-0045) under the stable `PACK_VIEW_CONSUMER_GROUP`. Payload pinned by product-master's `apis/asyncapi.yaml` on `develop`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProductPackLevelRetired CloudEvent (consumed)",
                "description": "CloudEvent envelope of product-master's ProductPackLevelRetired, mirrored read-only from the producer's own contract. This service consumes it (ADR-0045); it never publishes it.",
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
                        "const": "com.warehouse.wms.product-master.product.ProductPackLevelRetired",
                        "x-parser-schema-id": "<anonymous-schema-333>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:product-master:events:ProductPackLevelRetired:v1",
                        "x-parser-schema-id": "<anonymous-schema-334>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "level",
                          "gtin",
                          "effective_to",
                          "reason",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-336>"
                          },
                          "level": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-337>"
                          },
                          "gtin": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-338>"
                          },
                          "effective_to": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-339>"
                          },
                          "reason": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-340>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-341>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-335>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-332>"
                  }
                ],
                "x-parser-schema-id": "ProductPackLevelRetiredEvent"
              }
            },
            {
              "name": "ProductPackLevelMeasured",
              "title": "ProductPackLevelMeasured (consumed)",
              "summary": "product-master measured a pack level of a SKU.",
              "description": "CONSUMED from `warehouse.product-master.events` - this entry mirrors the producer's own contract read-only and is NOT published by this service. Feeds the local PackView (ADR-0045) under the stable `PACK_VIEW_CONSUMER_GROUP`. Payload pinned by product-master's `apis/asyncapi.yaml` on `develop`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ProductPackLevelMeasured CloudEvent (consumed)",
                "description": "CloudEvent envelope of product-master's ProductPackLevelMeasured, mirrored read-only from the producer's own contract. This service consumes it (ADR-0045); it never publishes it.",
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
                        "const": "com.warehouse.wms.product-master.product.ProductPackLevelMeasured",
                        "x-parser-schema-id": "<anonymous-schema-343>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:product-master:events:ProductPackLevelMeasured:v1",
                        "x-parser-schema-id": "<anonymous-schema-344>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "level",
                          "gtin",
                          "dims",
                          "measured_at",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-346>"
                          },
                          "level": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-347>"
                          },
                          "gtin": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-348>"
                          },
                          "dims": {
                            "type": "object",
                            "required": [
                              "length_mm",
                              "width_mm",
                              "height_mm",
                              "weight_g"
                            ],
                            "properties": {
                              "length_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-350>"
                              },
                              "width_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-351>"
                              },
                              "height_mm": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 20000,
                                "x-parser-schema-id": "<anonymous-schema-352>"
                              },
                              "weight_g": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 2000000,
                                "x-parser-schema-id": "<anonymous-schema-353>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-349>"
                          },
                          "measured_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-354>"
                          },
                          "device_id": {
                            "type": "string",
                            "description": "Omitted for a manual measurement.",
                            "x-parser-schema-id": "<anonymous-schema-355>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-356>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-345>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-342>"
                  }
                ],
                "x-parser-schema-id": "ProductPackLevelMeasuredEvent"
              }
            }
          ]
        }
      }
    },
    "warehouse.inventory.events": {
      "description": "inventory-storage's integration topic, CONSUMED by this service (owned by that bounded context; listed here read-only for orientation, mirroring its own apis/asyncapi.yaml). Key = the reservation id. This service consumes only StockReserved and ReservationRevoked (the integration payloads; both share one identical `data` shape) and ignores every other type on the topic.",
      "publish": {
        "operationId": "consumeInventoryReservationEvents",
        "summary": "Keep the SKU-keyed usable-inventory projection current.",
        "description": "The shared inbound consumer applies each event to the SKU-keyed UsableInventoryObserved projection: StockReserved decrements the SKU's usable quantity by `quantity`, ReservationRevoked increments it back. Messages are CloudEvents 1.0 structured-mode JSON (dataschema `urn:warehouse:inventory-storage:events:<EventName>:v1`). Every other CloudEvents `type` on the topic is ignored; a message that is not a valid CloudEvent is logged at WARN and skipped.",
        "message": {
          "oneOf": [
            {
              "name": "StockReserved",
              "title": "Stock Reserved (consumed)",
              "summary": "inventory-storage bound a SKU's quantity to a demand.",
              "description": "CONSUMED from `warehouse.inventory.events` — this entry mirrors the producer's own contract (StockReservedEvent) read-only and is NOT published by this service. `sku`, `quantity` and `demand_ref` are read; the projection decrements usable inventory for the SKU by `quantity`.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "StockReserved CloudEvent (consumed)",
                "description": "Mirror of inventory-storage's StockReservedEvent, the integration-payload variant (read-only).",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.inventory-storage.reservation.StockReserved",
                        "x-parser-schema-id": "<anonymous-schema-358>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:inventory-storage:events:StockReserved:v1",
                        "x-parser-schema-id": "<anonymous-schema-359>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Identical in shape to ReservationRevoked's payload.",
                        "required": [
                          "sku",
                          "quantity",
                          "demand_ref"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit the quantity was reserved against.",
                            "x-parser-schema-id": "<anonymous-schema-361>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity bound to the demand; decrements usable inventory.",
                            "x-parser-schema-id": "<anonymous-schema-362>"
                          },
                          "demand_ref": {
                            "type": "string",
                            "description": "Opaque reference to the demand the reservation serves.",
                            "x-parser-schema-id": "<anonymous-schema-363>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-360>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-357>"
                  }
                ],
                "x-parser-schema-id": "StockReservedEvent"
              },
              "examples": [
                {
                  "name": "stockReserved",
                  "summary": "12 units of SKU-1 reserved against an order.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.StockReserved",
                    "subject": "resv-9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
                    "time": "2026-10-17T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:StockReserved:v1",
                    "data": {
                      "sku": "SKU-1",
                      "quantity": 12,
                      "demand_ref": "order-88421"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReservationRevoked",
              "title": "Reservation Revoked (consumed)",
              "summary": "inventory-storage released a reservation's quantity back to usable.",
              "description": "CONSUMED from `warehouse.inventory.events` — this entry mirrors the producer's own contract (ReservationRevokedEvent) read-only and is NOT published by this service. `sku`, `quantity` and `demand_ref` are read; the projection increments usable inventory for the SKU back by `quantity`. The payload shape is identical to StockReserved's, so one handler applies both.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "work-planning"
                }
              ],
              "payload": {
                "title": "ReservationRevoked CloudEvent (consumed)",
                "description": "Mirror of inventory-storage's ReservationRevokedEvent, the integration-payload variant (read-only).",
                "allOf": [
                  "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.inventory-storage.reservation.ReservationRevoked",
                        "x-parser-schema-id": "<anonymous-schema-365>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:inventory-storage:events:ReservationRevoked:v1",
                        "x-parser-schema-id": "<anonymous-schema-366>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Identical in shape to StockReserved's payload.",
                        "required": [
                          "sku",
                          "quantity",
                          "demand_ref"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit whose quantity returns to usable.",
                            "x-parser-schema-id": "<anonymous-schema-368>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity released back into usable inventory.",
                            "x-parser-schema-id": "<anonymous-schema-369>"
                          },
                          "demand_ref": {
                            "type": "string",
                            "description": "The demand reference the revoked reservation was serving.",
                            "x-parser-schema-id": "<anonymous-schema-370>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-367>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-364>"
                  }
                ],
                "x-parser-schema-id": "ReservationRevokedEvent"
              },
              "examples": [
                {
                  "name": "reservationRevoked",
                  "summary": "The same 12 units return to usable after a cancellation.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.ReservationRevoked",
                    "subject": "resv-9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
                    "time": "2026-10-17T09:45:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:ReservationRevoked:v1",
                    "data": {
                      "sku": "SKU-1",
                      "quantity": 12,
                      "demand_ref": "order-88421"
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
      "ChargeForecastReceived": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0]",
      "ShiftPlanCommitted": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[1]",
      "WorkUnitCreated": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[2]",
      "WorkDemandReleased": "$ref:$.channels.warehouse.network-inventory-planning.events.publish.message",
      "SlotPlanApproved": "$ref:$.channels.warehouse.slotting-optimization.events.publish.message",
      "StockReserved": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[0]",
      "ReservationRevoked": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[1]",
      "ReplenishmentRequested": "$ref:$.channels.warehouse.pick-face-replenishment.events.publish.message.oneOf[0]",
      "ReplenishmentCancelled": "$ref:$.channels.warehouse.pick-face-replenishment.events.publish.message.oneOf[1]",
      "ProductClassified": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[0]",
      "WorkforceShiftPlanCommitted": "$ref:$.channels.warehouse.workforce.events.publish.message",
      "TaskCompleted": "$ref:$.channels.warehouse.fulfillment.events.publish.message",
      "OrderAllocated": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0]",
      "OrderPartiallyAllocated": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[1]",
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2]",
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
      "PathPlanDriftDetectedAnalytics": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[10]",
      "ProductPackLevelDeclared": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[1]",
      "ProductPackLevelRetired": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[2]",
      "ProductPackLevelMeasured": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[3]"
    },
    "schemas": {
      "CloudEventBase": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "ChargeForecastReceivedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[0].payload",
      "ShiftPlanCommittedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[1].payload",
      "WorkUnitCreatedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.oneOf[2].payload",
      "WorkDemandReleasedEvent": "$ref:$.channels.warehouse.network-inventory-planning.events.publish.message.payload",
      "SlotPlanApprovedEvent": "$ref:$.channels.warehouse.slotting-optimization.events.publish.message.payload",
      "StockReservedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[0].payload",
      "ReservationRevokedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[1].payload",
      "ReplenishmentRequestedEvent": "$ref:$.channels.warehouse.pick-face-replenishment.events.publish.message.oneOf[0].payload",
      "ReplenishmentCancelledEvent": "$ref:$.channels.warehouse.pick-face-replenishment.events.publish.message.oneOf[1].payload",
      "ProductClassifiedEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[0].payload",
      "WorkforceShiftPlanCommittedEvent": "$ref:$.channels.warehouse.workforce.events.publish.message.payload",
      "TaskCompletedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.payload",
      "OrderAllocatedEvent": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0].payload",
      "OrderPartiallyAllocatedEvent": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[1].payload",
      "ProcessPathCreatedEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload",
      "ProcessPathUpdatedEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1].payload",
      "ProcessPathDeactivatedEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2].payload",
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
      "PathPlanDriftDetectedAnalyticsEvent": "$ref:$.channels.warehouse.wes.analytics.subscribe.message.oneOf[10].payload",
      "ProductPackLevelDeclaredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[1].payload",
      "ProductPackLevelRetiredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[2].payload",
      "ProductPackLevelMeasuredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[3].payload"
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
  