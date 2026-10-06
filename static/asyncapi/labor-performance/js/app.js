
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Labor Performance — Event Contracts",
    "version": "2.0.0",
    "description": "Event contracts for the **Labor Performance** bounded context, in\nthree directions:\n\n- **Inbound (`warehouse.fulfillment.events`)** — the integration\n  contract this service consumes. Documented below in full; this is what\n  the original v1 of this file covered.\n- **Outbound analytics (`warehouse.labor-performance.analytics`)** — the\n  ANALYTICS stream this service publishes its own domain events to,\n  feeding its own analytical data product's projector (ADR 0007). It is\n  consumed today only by this repo's own `cmd/labor-projector`; no other\n  service subscribes. Publishing is opt-in via `EVENT_PUBLISHER=kafka`,\n  with the log publisher as the default.\n- **Outbound integration (`warehouse.labor-performance.events`)** — this\n  service's first Open-Host-Service topic for OTHER bounded contexts\n  (ADR 0013). Before this topic existed, labor-performance was the\n  fleet's only pure event sink: it consumed `TaskCompleted` from\n  fulfillment-execution but published nothing any sibling service could\n  subscribe to. `TaskPerformanceRecorded` is published here so\n  workforce-management (the first intended consumer) can build an\n  event-fed local cache instead of calling this service synchronously\n  over REST. Publishing is opt-in via `EVENT_PUBLISHER=kafka`, same as\n  the analytics stream.\n\nThe three are deliberately separate topics so the integration contracts\n(inbound and outbound) and the analytical stream all evolve\nindependently.\n\n## Inbound: a pure consumer of fulfillment-execution\n\nUnlike every other `apis/asyncapi.yaml` in this fleet (which document\nonly what a service PUBLISHES), this section describes what this\nservice SUBSCRIBES TO: it is a **pure Kafka consumer** of\n`fulfillment-execution`'s already-published `TaskCompleted` integration\nevent. This service has no REST or Go-import dependency on\nfulfillment-execution — everything it needs (`associate_id`, `task_id`,\n`duration_seconds`) already travels on the Kafka event (see the\nbounded-context-boundary decision in ADR\n0003-kafka-choreography-consumer-of-fulfillment-execution.md).\n\n## Message format: CloudEvents 1.0 (mandatory, ADR 0021)\n\nEvery message on every channel below — inbound and outbound,\nintegration and analytics — is a **CloudEvents 1.0** event in\nstructured content mode (Kafka message value =\n`application/cloudevents+json`, Kafka header\n`content-type: application/cloudevents+json; charset=UTF-8`). There is\nno other envelope: the retired flat envelope is rejected by every\nconsumer (dead-lettered on `warehouse.fulfillment.events`, skipped with\na WARN on the analytics topic).\n\n```json\n{\n  \"specversion\": \"1.0\",\n  \"id\": \"4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90\",\n  \"source\": \"/warehouse/fulfillment-execution\",\n  \"type\": \"com.warehouse.wes.fulfillment-execution.task.TaskCompleted\",\n  \"subject\": \"task-10231\",\n  \"time\": \"2026-08-29T22:00:00Z\",\n  \"datacontenttype\": \"application/json\",\n  \"dataschema\": \"urn:warehouse:fulfillment-execution:events:TaskCompleted:v1\",\n  \"data\": { ... }\n}\n```\n\nAll attributes are required. `id` is the de-duplication key this\nservice uses (the `ProcessedEvents` idempotency gate) — NOT `task_id`.\nConsumers dispatch on the FULL `type` string and ignore unknown types.\n`dataschema` distinguishes the integration (`:events:`) payload from\nthe analytics (`:analytics:`) payload of the same occurrence, which\nshare one `type`.\n\n## Shared, fan-out topic\n\n`warehouse.fulfillment.events` is the SAME topic `wes-work-planning`\nalready consumes from, under its own consumer group. This service uses\nits own consumer group id (`labor-performance` by default,\n`KAFKA_CONSUMER_GROUP` env), so both consumers see every message\nindependently. Only `type ==\n\"com.warehouse.wes.fulfillment-execution.task.TaskCompleted\"` is acted on — every\nother event type on this shared topic (there are none from\nfulfillment-execution today, but the topic is shared/fan-out by\nconvention) is silently skipped, not an error.\n\n## `task_type` on the inbound wire\n\nfulfillment-execution's TaskCompleted carries `task_type` (its\nADR-0023). An unrecognized or absent value resolves to `\"\"`\n(unclassified) via `shared.ParseTaskTypeLenient`, never a rejection.\n\n## Graceful degradation on an older payload\n\n`associate_id` and `duration_seconds` are the two fields added by\nfulfillment-execution's `feature/labor-performance-hooks` change. Both\nare optional on the wire (`omitempty` on the publisher's own struct):\nan older payload that predates that enrichment simply omits them, and\nthis service's JSON unmarshaling already degrades those absent fields\nto their Go zero values (`\"\"` / `0`) — exactly the \"no checked-in\noccupant\" / \"unmeasurable duration\" business facts this service's own\naggregate invariants already model, not an error.\n",
    "contact": {
      "name": "Labor Performance Team",
      "url": "https://github.com/claudioed/labor-performance",
      "email": "labor-performance@warehouse-systems.internal"
    },
    "license": {
      "name": "MIT"
    }
  },
  "tags": [
    {
      "name": "labor-performance",
      "description": "The Labor Performance bounded context (Supporting subdomain)."
    },
    {
      "name": "task",
      "description": "Events describing the Task aggregate lifecycle, owned by fulfillment-execution."
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Shared Kafka broker for warehouse-systems integration events. Locally, a broker is available at localhost:9092 via ~/warehouse-systems/docker-compose.kafka.yml."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.fulfillment.events": {
      "description": "The shared, fan-out topic owned by fulfillment-execution (its `kafka.Topic` constant). This service subscribes to it under its own consumer group and acts only on `TaskCompleted` messages.",
      "subscribe": {
        "operationId": "consumeTaskCompleted",
        "summary": "Consume TaskCompleted events from fulfillment-execution.",
        "description": "Feeds each TaskCompleted message into the RecordTaskPerformance use case, which is idempotent on the CloudEvents `id` and resolves whichever LaborStandard was active for the task's type AS OF the CloudEvents `time` attribute (not \"active right now\"), so a possibly out-of-order or replayed message is scored against the standard genuinely in force when the task completed. Every other event type on this topic is silently skipped; a message that is not a valid CloudEvent is sent to `warehouse.fulfillment.events.dlq` and committed past.",
        "tags": [
          {
            "name": "task"
          }
        ],
        "message": {
          "name": "TaskCompleted",
          "title": "Task Completed",
          "summary": "A station finished a claimed task; fulfillment-execution's fact.",
          "description": "Raised by fulfillment-execution's Task aggregate when a station completes a claimed task. This service consumes it to record a TaskPerformance row scored against whatever LaborStandard was active for the task's type at completion time.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "task"
            }
          ],
          "payload": {
            "title": "CloudEvent + TaskCompleted data (fulfillment-execution, consumed)",
            "allOf": [
              {
                "type": "object",
                "title": "CloudEvents 1.0 envelope (structured mode, ADR 0021)",
                "description": "The ONLY envelope on every topic this service produces or consumes. Every attribute is REQUIRED in this fleet. Kafka header `content-type: application/cloudevents+json; charset=UTF-8`. W3C trace context travels in the `traceparent`/`tracestate` Kafka headers, never as extension attributes.",
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
                    "description": "Minted once per domain event and persisted with the outbox row, so a relay redelivery carries the same id. The consumer's de-duplication key.",
                    "x-parser-schema-id": "<anonymous-schema-2>"
                  },
                  "source": {
                    "type": "string",
                    "format": "uri-reference",
                    "description": "`/warehouse/<repo>` of the publisher — `/warehouse/labor-performance` for everything this service publishes, `/warehouse/fulfillment-execution` for TaskCompleted.",
                    "x-parser-schema-id": "<anonymous-schema-3>"
                  },
                  "type": {
                    "type": "string",
                    "description": "`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`. Consumers dispatch on the FULL string.",
                    "x-parser-schema-id": "<anonymous-schema-4>"
                  },
                  "subject": {
                    "type": "string",
                    "minLength": 1,
                    "description": "Id of the aggregate instance the event is about. Never empty.",
                    "x-parser-schema-id": "<anonymous-schema-5>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "description": "The domain event's occurred-at instant, UTC (RFC 3339).",
                    "x-parser-schema-id": "<anonymous-schema-6>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "const": "application/json",
                    "x-parser-schema-id": "<anonymous-schema-7>"
                  },
                  "dataschema": {
                    "type": "string",
                    "format": "uri",
                    "description": "`urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>`",
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
                    "const": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                    "x-parser-schema-id": "<anonymous-schema-11>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                    "x-parser-schema-id": "<anonymous-schema-12>"
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
                        "description": "fulfillment-execution's Task id, treated as an opaque foreign reference this context does not validate further.",
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      },
                      "station_id": {
                        "type": "string",
                        "description": "Identifier of the station that completed the task.",
                        "x-parser-schema-id": "<anonymous-schema-14>"
                      },
                      "work_unit_id": {
                        "type": "string",
                        "description": "wes-work-planning's WorkUnit id for the completed task. Not currently used by this service.",
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      },
                      "associate_id": {
                        "type": "string",
                        "description": "OPTIONAL. The occupant of the completing station at completion time. Absent — not an empty string — when the station had no checked-in occupant (e.g. a robot station), or on a pre-enrichment payload. This service treats an absent field identically to an empty string: the resulting TaskPerformance is recorded with `AssociateId=\"\"` and is excluded from any per-associate scorecard while still counting in fleet-wide TaskType performance.",
                        "example": "assoc-4471",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "duration_seconds": {
                        "type": "integer",
                        "format": "int64",
                        "description": "OPTIONAL. Elapsed time between the task's claim and its completion. Absent — not `0` — when no claim timestamp existed to compute it from (e.g. a task claimed before fulfillment-execution's claim-timestamp migration), or on a pre-enrichment payload. This service treats an absent field identically to `0`: the resulting TaskPerformance is recorded with `ActualSeconds=0` and `EfficiencyPct=null`, a real, expected \"unmeasurable\" business fact, not an error.",
                        "example": 52,
                        "x-parser-schema-id": "<anonymous-schema-17>"
                      }
                    },
                    "x-parser-schema-id": "TaskCompletedData"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-10>"
              }
            ],
            "x-parser-schema-id": "TaskCompletedCloudEvent"
          },
          "examples": [
            {
              "name": "taskCompletedWithAssociateAndDuration",
              "summary": "A PICK task completed by a checked-in associate, with a measurable duration.",
              "payload": {
                "specversion": "1.0",
                "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "subject": "task-10231",
                "time": "2026-08-29T22:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "data": {
                  "task_id": "task-10231",
                  "station_id": "station-7",
                  "work_unit_id": "order-88421-line-3",
                  "associate_id": "assoc-4471",
                  "duration_seconds": 52
                }
              }
            },
            {
              "name": "taskCompletedNoOccupant",
              "summary": "A task completed at a station with no checked-in occupant (for example, a robot station). associate_id is omitted from the wire, not sent as an empty string.",
              "payload": {
                "specversion": "1.0",
                "id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "subject": "task-10232",
                "time": "2026-08-29T22:05:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "data": {
                  "task_id": "task-10232",
                  "station_id": "station-robot-1",
                  "work_unit_id": "order-88422-line-1",
                  "duration_seconds": 40
                }
              }
            },
            {
              "name": "taskCompletedNoDuration",
              "summary": "A task claimed before fulfillment-execution's claim-timestamp migration, so no duration could be computed. duration_seconds is omitted from the wire, not sent as 0 — though this service treats an explicit 0 identically.",
              "payload": {
                "specversion": "1.0",
                "id": "c25b9f83-7e64-4a19-b8d2-0f5a3c6e1b47",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "subject": "task-10233",
                "time": "2026-08-29T22:10:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "data": {
                  "task_id": "task-10233",
                  "station_id": "station-3",
                  "work_unit_id": "order-88423-line-1",
                  "associate_id": "assoc-4472"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.labor-performance.analytics": {
      "description": "The dedicated ANALYTICS topic this service owns and publishes to, feeding its own analytical data product's projector (cmd/labor-projector). Separate from any integration topic so the analytical stream and the integration contract evolve independently (ADR 0007). Publishing is opt-in via `EVENT_PUBLISHER=kafka`; the default remains the log publisher.",
      "publish": {
        "operationId": "publishLaborAnalyticsEvents",
        "summary": "Publish this service's own domain events for its analytical read model.",
        "description": "Emits LaborStandardDefined, LaborStandardRevised and TaskPerformanceRecorded onto the analytics topic as CloudEvents 1.0 events whose `dataschema` is `urn:warehouse:labor-performance:analytics:<EventName>:v1`. The message key is the TaskType, so every event folding into one report dimension lands on a single partition and is applied in publish order. The CloudEvents `id` is the projector's de-duplication key. These events are consumed only by this repo's own projector today; no other service subscribes.",
        "tags": [
          {
            "name": "labor-performance"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "LaborStandardDefined",
              "title": "Labor Standard Defined",
              "summary": "A TaskType had no active standard, and one was just defined.",
              "description": "Raised when DefineStandard creates the first engineered standard for a TaskType. The projector counts it into the (task_type, hour-of- effective_from) rollup row.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "labor-performance"
                }
              ],
              "payload": {
                "title": "CloudEvent + LaborStandardDefined data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.labor-performance.standard.LaborStandardDefined",
                        "x-parser-schema-id": "<anonymous-schema-19>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:labor-performance:analytics:LaborStandardDefined:v1",
                        "x-parser-schema-id": "<anonymous-schema-20>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "standard_id",
                          "task_type",
                          "expected_seconds",
                          "effective_from"
                        ],
                        "properties": {
                          "standard_id": {
                            "type": "string",
                            "description": "Identifies this one record in the standard's append-only history. A revision mints a new id rather than reusing the prior one.",
                            "example": "std-0001",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM"
                            ],
                            "description": "The task type this standard applies to.",
                            "example": "PICK",
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          },
                          "expected_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "description": "The engineered expected duration. Always greater than zero.",
                            "example": 45,
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "travel_component_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 0,
                            "description": "Optional declaration of how much of expected_seconds is attributable to travel between locations for this task type. Omitted entirely (not present, not null) when the standard never declared one — the default, most common case. This service never computes or validates it against a live location lookup (ADR 0015).",
                            "example": 15,
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "effective_from": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the standard came into force. The BUSINESS time the projector buckets this event on.",
                            "example": "2026-09-05T09:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          }
                        },
                        "x-parser-schema-id": "LaborStandardDefinedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-18>"
                  }
                ],
                "x-parser-schema-id": "LaborStandardDefinedCloudEvent"
              },
              "examples": [
                {
                  "name": "firstPickStandard",
                  "summary": "The first PICK standard, 45 seconds.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1b9e4c02-73a5-4d18-9e6f-2c8b0a4d7e35",
                    "source": "/warehouse/labor-performance",
                    "type": "com.warehouse.wes.labor-performance.standard.LaborStandardDefined",
                    "subject": "std-0001",
                    "time": "2026-09-05T09:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:labor-performance:analytics:LaborStandardDefined:v1",
                    "data": {
                      "standard_id": "std-0001",
                      "task_type": "PICK",
                      "expected_seconds": 45,
                      "effective_from": "2026-09-05T09:00:00Z"
                    }
                  }
                },
                {
                  "name": "firstPickStandardWithTravelComponent",
                  "summary": "A first PICK standard declaring a 15s travel component.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2c0f5d13-84b6-5e29-af70-3d9c1b5e8f46",
                    "source": "/warehouse/labor-performance",
                    "type": "com.warehouse.wes.labor-performance.standard.LaborStandardDefined",
                    "subject": "std-0003",
                    "time": "2026-09-05T09:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:labor-performance:analytics:LaborStandardDefined:v1",
                    "data": {
                      "standard_id": "std-0003",
                      "task_type": "PICK",
                      "expected_seconds": 45,
                      "travel_component_seconds": 15,
                      "effective_from": "2026-09-05T09:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "LaborStandardRevised",
              "title": "Labor Standard Revised",
              "summary": "An active standard was closed and a new one started in its place.",
              "description": "Raised when DefineStandard is called for a TaskType that already has an active standard. History is append-only — the prior standard is closed, never overwritten (ADR 0004). A bucket with a non-zero revision count is one whose efficiency figures span two different yardsticks and are not directly comparable across the boundary.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "labor-performance"
                }
              ],
              "payload": {
                "title": "CloudEvent + LaborStandardRevised data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.labor-performance.standard.LaborStandardRevised",
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:labor-performance:analytics:LaborStandardRevised:v1",
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "standard_id",
                          "task_type",
                          "previous_expected_seconds",
                          "expected_seconds",
                          "effective_from"
                        ],
                        "properties": {
                          "standard_id": {
                            "type": "string",
                            "description": "The id of the NEW standard record opened by this revision.",
                            "example": "std-0002",
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM"
                            ],
                            "example": "PICK",
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          },
                          "previous_expected_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "description": "The now-closed standard's expected duration, carried so a consumer can see the size of the change without joining back to the prior event.",
                            "example": 45,
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "expected_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "description": "The newly effective expected duration.",
                            "example": 40,
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "travel_component_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 0,
                            "description": "Optional declaration of how much of the NEW (revised) expected_seconds is attributable to travel — always the revision's own value, never carried over from the closed prior standard. Omitted entirely when the revision does not declare one.",
                            "example": 20,
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "effective_from": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the new standard came into force — the same instant the prior one was closed. The BUSINESS time the projector buckets this event on.",
                            "example": "2026-09-05T10:00:00Z",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          }
                        },
                        "x-parser-schema-id": "LaborStandardRevisedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-26>"
                  }
                ],
                "x-parser-schema-id": "LaborStandardRevisedCloudEvent"
              },
              "examples": [
                {
                  "name": "tightenPickStandard",
                  "summary": "The PICK standard tightened from 45s to 40s.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6d2f81ba-4e07-4b93-a1c5-9f3e7d0b2648",
                    "source": "/warehouse/labor-performance",
                    "type": "com.warehouse.wes.labor-performance.standard.LaborStandardRevised",
                    "subject": "std-0002",
                    "time": "2026-09-05T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:labor-performance:analytics:LaborStandardRevised:v1",
                    "data": {
                      "standard_id": "std-0002",
                      "task_type": "PICK",
                      "previous_expected_seconds": 45,
                      "expected_seconds": 40,
                      "effective_from": "2026-09-05T10:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "TaskPerformanceRecorded",
              "title": "Task Performance Recorded",
              "summary": "One completed task was scored against the standard active at completion time.",
              "description": "Raised by RecordTaskPerformance for every consumed TaskCompleted.\n`efficiency_pct` is NULLABLE and null is a real, expected value, not a missing field: it is null whenever the task could not be scored — no active standard for its TaskType at completion time, or a non-positive duration. Consumers MUST NOT coerce null to 0; doing so would report an unmeasurable task as a 0%-efficient one. The projector counts such an event toward its bucket's task count while excluding it from the mean.\n`completed_at` is the BUSINESS time and is what the projector buckets on — distinct from the CloudEvents `time` attribute, which is the domain occurred-at and feeds only the freshness watermark. The two differ for any replayed or late-ingested event.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                }
              ],
              "payload": {
                "title": "CloudEvent + TaskPerformanceRecorded data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                        "x-parser-schema-id": "<anonymous-schema-36>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:labor-performance:analytics:TaskPerformanceRecorded:v1",
                        "x-parser-schema-id": "<anonymous-schema-37>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type",
                          "actual_seconds",
                          "completed_at"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "fulfillment-execution's task id, treated as an opaque foreign reference. This context does not own or validate it.",
                            "example": "task-10231",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "associate_id": {
                            "type": "string",
                            "description": "The associate who completed the task. The EMPTY STRING is a legitimate, expected value: the completing station had no checked-in occupant (e.g. a robot station). Such a task is still counted in task-type reporting; it is only excluded from per-associate scorecards.",
                            "example": "assoc-4471",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "task_type": {
                            "type": "string",
                            "description": "PICK, PACK, SLAM, or the empty string when the task type could not be resolved. Empty is the normal case TODAY: fulfillment-execution's TaskCompleted payload carries no task_type field yet. The projector labels the empty case `UNCLASSIFIED` rather than dropping the row or keying its fact table on an empty string.",
                            "example": "PICK",
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          },
                          "efficiency_pct": {
                            "type": "number",
                            "format": "double",
                            "nullable": true,
                            "description": "100 * standard_seconds_at_completion / actual_seconds, or NULL when the task could not be scored — no active standard for its TaskType at completion time, or a non-positive duration. NULL is a real business fact (\"unmeasurable\"), never an error and never to be coerced to 0 by a consumer.",
                            "example": 86.5,
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "actual_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "description": "The measured duration, from the inbound event's duration_seconds. `0` means unmeasurable and is excluded from any mean-duration aggregate.",
                            "example": 52,
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "idle_seconds_before": {
                            "type": "integer",
                            "format": "int64",
                            "nullable": true,
                            "description": "The measured idle gap immediately preceding this task's claim (previous completion -> this claim instant), added by the idleness feature (ADR 0014-labor-utilization-idleness). NULL — never a fabricated number — when there was no prior completion to measure from (this associate's first- ever observation), the gap was negative/zero (out-of-order Kafka delivery), or the completing station had no checked-in occupant. ADDITIVE field: a Conformist unmarshaling unknown-field-tolerant JSON is unaffected by its presence.",
                            "example": 90,
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "completed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the associate actually finished the task. The BUSINESS time the projector buckets this event on — NOT the CloudEvents `time`, so a replayed or late-ingested event lands in the hour the work really happened.",
                            "example": "2026-09-05T09:30:00Z",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          }
                        },
                        "x-parser-schema-id": "TaskPerformanceRecordedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-35>"
                  }
                ],
                "x-parser-schema-id": "TaskPerformanceRecordedAnalyticsCloudEvent"
              },
              "examples": [
                {
                  "name": "scoredTask",
                  "summary": "A task scored at 86.5% of standard, with a 90s idle gap before it.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9c47e3d5-08b2-41fa-bd76-5a1e2c9f4830",
                    "source": "/warehouse/labor-performance",
                    "type": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                    "subject": "assoc-4471",
                    "time": "2026-09-05T11:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:labor-performance:analytics:TaskPerformanceRecorded:v1",
                    "data": {
                      "task_id": "task-10231",
                      "associate_id": "assoc-4471",
                      "task_type": "PICK",
                      "efficiency_pct": 86.5,
                      "actual_seconds": 52,
                      "idle_seconds_before": 90,
                      "completed_at": "2026-09-05T09:30:00Z"
                    }
                  }
                },
                {
                  "name": "unscorableTask",
                  "summary": "A real, counted task that could not be scored: no task_type on the inbound wire (so no standard could be resolved) and no measurable duration. efficiency_pct is explicitly null.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3e8a1f66-b204-47c9-8d51-7b0c6e2a9d14",
                    "source": "/warehouse/labor-performance",
                    "type": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                    "subject": "task-10233",
                    "time": "2026-09-05T11:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:labor-performance:analytics:TaskPerformanceRecorded:v1",
                    "data": {
                      "task_id": "task-10233",
                      "associate_id": "",
                      "task_type": "",
                      "efficiency_pct": null,
                      "actual_seconds": 0,
                      "idle_seconds_before": null,
                      "completed_at": "2026-09-05T09:45:00Z"
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
      "description": "The dedicated INTEGRATION topic this service owns and publishes to (ADR 0013) — its first Open-Host-Service Published Language for OTHER bounded contexts to consume. Separate from the analytics topic above (which feeds only this repo's own projector) so the two streams evolve independently. Before this topic existed, labor-performance was the fleet's only pure event sink: it consumed `TaskCompleted` from fulfillment-execution but published nothing any sibling service could subscribe to. Publishing is opt-in via `EVENT_PUBLISHER=kafka`; the default remains the log publisher. The intended first consumer is workforce-management, building an event-fed local cache to replace a synchronous HTTP call (a parallel change to this one).",
      "publish": {
        "operationId": "publishLaborIntegrationEvents",
        "summary": "Publish TaskPerformanceRecorded for other bounded contexts to consume.",
        "description": "Emits TaskPerformanceRecorded onto the integration topic as a CloudEvents 1.0 event, type `com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded`, dataschema `urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1`, subject = the associate id (the task id when there is no associate, since `subject` is never empty). The message key is the AssociateId — NOT the TaskType the analytics topic keys on — so every event for one associate lands on a single partition and is applied in publish order, which is what a per-associate read-cache consumer needs. A task with no checked-in associate (e.g. a robot station) is keyed on the empty string. The CloudEvents `id` is the consumer's de-duplication key.\nOnly `TaskPerformanceRecorded` is part of this contract today. `LaborStandardDefined`/`LaborStandardRevised` remain analytics-only; widening this topic to carry them is a future, additive change.",
        "tags": [
          {
            "name": "labor-performance"
          }
        ],
        "message": {
          "name": "TaskPerformanceRecorded",
          "title": "Task Performance Recorded (integration)",
          "summary": "One completed task was scored against the standard active at completion time — published for other bounded contexts (ADR 0013).",
          "description": "Raised by RecordTaskPerformance for every consumed TaskCompleted, the SAME domain event as the analytics stream's TaskPerformanceRecorded message, on a different topic and with the `:events:` dataschema. Partition key is AssociateId, not TaskType.\n`efficiency_pct` is NULLABLE and null is a real, expected value: null whenever the task could not be scored — no active standard for its TaskType at completion time, or a non-positive duration. Consumers MUST NOT coerce null to 0.\n`completed_at` is the BUSINESS time; the CloudEvents `time` attribute is the domain occurred-at (scoring) instant. The two differ for any replayed or late-ingested event.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "task"
            },
            {
              "name": "labor-performance"
            }
          ],
          "payload": {
            "title": "CloudEvent + TaskPerformanceRecorded data (integration stream)",
            "allOf": [
              "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                    "x-parser-schema-id": "<anonymous-schema-46>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1",
                    "x-parser-schema-id": "<anonymous-schema-47>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "task_id",
                      "task_type",
                      "actual_seconds",
                      "completed_at"
                    ],
                    "properties": {
                      "task_id": {
                        "type": "string",
                        "description": "fulfillment-execution's task id, treated as an opaque foreign reference. This context does not own or validate it.",
                        "example": "task-10231",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      },
                      "associate_id": {
                        "type": "string",
                        "description": "The associate who completed the task, and the partition key of this topic. The EMPTY STRING is a legitimate, expected value: the completing station had no checked-in occupant (e.g. a robot station).",
                        "example": "assoc-4471",
                        "x-parser-schema-id": "<anonymous-schema-49>"
                      },
                      "task_type": {
                        "type": "string",
                        "description": "PICK, PACK, SLAM, or the empty string when the task type could not be resolved (see the analytics payload's identical field for why this is common today).",
                        "example": "PICK",
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      },
                      "efficiency_pct": {
                        "type": "number",
                        "format": "double",
                        "nullable": true,
                        "description": "100 * standard_seconds_at_completion / actual_seconds, or NULL when the task could not be scored. NULL is a real business fact (\"unmeasurable\"); a consumer MUST NOT coerce it to 0.",
                        "example": 91.2,
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      },
                      "actual_seconds": {
                        "type": "integer",
                        "format": "int64",
                        "description": "The measured duration. `0` means unmeasurable.",
                        "example": 41,
                        "x-parser-schema-id": "<anonymous-schema-52>"
                      },
                      "idle_seconds_before": {
                        "type": "integer",
                        "format": "int64",
                        "nullable": true,
                        "description": "The measured idle gap immediately preceding this task's claim, added by the idleness feature (ADR 0014-labor-utilization-idleness). NULL — never a fabricated number — when there was no prior completion, the gap was negative/zero (out-of-order Kafka delivery), or the completing station had no checked-in occupant. ADDITIVE field: a Conformist unmarshaling unknown-field- tolerant JSON (e.g. workforce-management's laborperformancecache) is unaffected by its presence.",
                        "example": 90,
                        "x-parser-schema-id": "<anonymous-schema-53>"
                      },
                      "completed_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the associate actually finished the task — the BUSINESS time, distinct from the CloudEvents `time` attribute.",
                        "example": "2026-09-05T09:30:00Z",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      }
                    },
                    "x-parser-schema-id": "TaskPerformanceRecordedEventsData"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-45>"
              }
            ],
            "x-parser-schema-id": "TaskPerformanceRecordedEventsCloudEvent"
          },
          "examples": [
            {
              "name": "scoredTaskIntegration",
              "summary": "A task scored at 91.2% of standard, with a 90s idle gap before it, published for a downstream consumer.",
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
            },
            {
              "name": "unscorableTaskIntegration",
              "summary": "A real, counted task that could not be scored, on the integration topic. efficiency_pct is explicitly null.",
              "payload": {
                "specversion": "1.0",
                "id": "1c9f4b82-6e35-4a07-bd91-2f8e5c3a7d64",
                "source": "/warehouse/labor-performance",
                "type": "com.warehouse.wes.labor-performance.performance.TaskPerformanceRecorded",
                "subject": "task-10233",
                "time": "2026-09-05T11:05:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:labor-performance:events:TaskPerformanceRecorded:v1",
                "data": {
                  "task_id": "task-10233",
                  "associate_id": "",
                  "task_type": "",
                  "efficiency_pct": null,
                  "actual_seconds": 0,
                  "idle_seconds_before": null,
                  "completed_at": "2026-09-05T09:45:00Z"
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
      "LaborStandardDefined": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[0]",
      "LaborStandardRevised": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[1]",
      "TaskPerformanceRecorded": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[2]",
      "TaskPerformanceRecordedIntegration": "$ref:$.channels.warehouse.labor-performance.events.publish.message",
      "TaskCompleted": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[0]",
      "TaskCompletedCloudEvent": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload",
      "LaborStandardDefinedCloudEvent": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[0].payload",
      "LaborStandardRevisedCloudEvent": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[1].payload",
      "TaskPerformanceRecordedAnalyticsCloudEvent": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[2].payload",
      "TaskPerformanceRecordedEventsCloudEvent": "$ref:$.channels.warehouse.labor-performance.events.publish.message.payload",
      "TaskCompletedData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.payload.allOf[1].properties.data",
      "LaborStandardDefinedData": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[0].payload.allOf[1].properties.data",
      "LaborStandardRevisedData": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[1].payload.allOf[1].properties.data",
      "TaskPerformanceRecordedAnalyticsData": "$ref:$.channels.warehouse.labor-performance.analytics.publish.message.oneOf[2].payload.allOf[1].properties.data",
      "TaskPerformanceRecordedEventsData": "$ref:$.channels.warehouse.labor-performance.events.publish.message.payload.allOf[1].properties.data"
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
  