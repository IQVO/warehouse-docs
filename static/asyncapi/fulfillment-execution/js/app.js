
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Fulfillment Execution Events API",
    "version": "2.0.0",
    "description": "Kafka events produced and consumed by the **Fulfillment Execution** bounded context (WES subdomain).\n\nEvery message — integration topic and analytics topic alike — is a **CloudEvents 1.0** event in the Kafka protocol binding's *structured* content mode (ADR-0032): the Kafka message value is the JSON event, and every message carries the Kafka header `content-type: application/cloudevents+json; charset=UTF-8` plus W3C `traceparent`/`tracestate`. There is no other envelope.\n\nRequired attributes: `specversion` (`1.0`), `id` (UUID v4, stable across outbox redelivery; the consumer idempotency key), `source` (`/warehouse/fulfillment-execution` for this service), `type` (`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`), `subject` (aggregate id, equal to the Kafka key), `time` (occurred-at, UTC), `datacontenttype` (`application/json`) and `dataschema` (`urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>`). `data` uses snake_case keys.\n\nThe same `type` names an occurrence on both the integration and analytics topics; `dataschema` names the payload shape. A breaking payload change ships as a new `.v2` type with a new dataschema version.",
    "contact": {
      "name": "Fulfillment Execution Team",
      "url": "https://github.com/claudioed/fulfillment-execution",
      "email": "fulfillment-execution@warehouse-systems.internal"
    },
    "license": {
      "name": "Proprietary",
      "url": "https://github.com/claudioed/fulfillment-execution"
    }
  },
  "tags": [
    {
      "name": "fulfillment-execution",
      "description": "The Fulfillment Execution bounded context (WES subdomain core)."
    },
    {
      "name": "task",
      "description": "Events raised by the Task aggregate."
    },
    {
      "name": "package",
      "description": "Events raised by the Package aggregate."
    },
    {
      "name": "promise-feedback",
      "description": "Events closing the promise feedback loop with order-management (ADR-0025)."
    },
    {
      "name": "analytics",
      "description": "Internal analytics stream for the throughput data product (ADR-0012)."
    },
    {
      "name": "consumed",
      "description": "Events published by sibling contexts and consumed by this service."
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Shared Kafka broker for warehouse-systems. Configured per service via KAFKA_BROKERS."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.fulfillment.events": {
      "description": "Integration events published by Fulfillment Execution, keyed by aggregate id. Consumers dispatch on the full CloudEvents `type`.",
      "subscribe": {
        "operationId": "consumeFulfillmentIntegrationEvents",
        "summary": "Consume Fulfillment Execution integration events.",
        "description": "Receive the TaskCompleted, TaskCPTMissed and PackageManifested CloudEvents this bounded context publishes.",
        "tags": [
          {
            "name": "fulfillment-execution"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "TaskCompleted",
              "title": "TaskCompleted",
              "summary": "A station finished a claimed task.",
              "description": "Raised when the station holding the active claim completes the task. Published on `warehouse.fulfillment.events`, keyed (and `subject`-ed) by task id, enriched at publish time with `work_unit_id` (the task's order reference, so Work Planning can call RecordCompletion), and `associate_id`, `duration_seconds`, `task_type` for labor-performance (ADR-0014, ADR-0023), and the optional `order_ref` (the order key inventory-storage uses to confirm picks, ADR-0040) and `line_no` (the order line, so it can confirm that line's reservation, ADR-0041). Consumed by wes-work-planning and labor-performance.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                }
              ],
              "headers": {
                "type": "object",
                "description": "Kafka message headers carried by every message.",
                "required": [
                  "content-type"
                ],
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "description": "CloudEvents structured-mode media type.",
                    "x-parser-schema-id": "<anonymous-schema-1>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C traceparent of the publishing span.",
                    "x-parser-schema-id": "<anonymous-schema-2>"
                  },
                  "tracestate": {
                    "type": "string",
                    "description": "W3C tracestate, present only when a vendor added entries.",
                    "x-parser-schema-id": "<anonymous-schema-3>"
                  }
                },
                "x-parser-schema-id": "KafkaHeaders"
              },
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "description": "CloudEvents 1.0 context attributes; every attribute is required in this fleet.",
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
                        "description": "CloudEvents spec version.",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "UUID v4, minted once per occurrence and stable across outbox redelivery.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "description": "Producing service, `/warehouse/<repo>`.",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "type": {
                        "type": "string",
                        "description": "`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`.",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "subject": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Aggregate instance id; equal to the Kafka message key.",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Domain occurred-at, UTC, RFC 3339.",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "description": "Content type of `data`.",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "`urn:warehouse:<repo>:<events|analytics>:<EventName>:v<N>`.",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Event payload (snake_case keys).",
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      }
                    },
                    "x-parser-schema-id": "CloudEvent"
                  },
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-17>"
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
                            "description": "Completed task id.",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "station_id": {
                            "type": "string",
                            "description": "Station that completed the task.",
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "The completed task's order reference (empty only when the task can no longer be found at publish time).",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "associate_id": {
                            "type": "string",
                            "description": "Occupant checked into the completing station at publish time; omitted when none (e.g. a robot station).",
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          },
                          "duration_seconds": {
                            "type": "integer",
                            "description": "Seconds between claim and completion; omitted when the claim time is unknown.",
                            "format": "int64",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN",
                              "DISPATCH",
                              "ARRIVAL"
                            ],
                            "description": "The completed task's own type; omitted only when the task can no longer be found.",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The order the completed task belongs to; the key inventory-storage uses to confirm picks. Optional and additive (the event stays v1) and omitted when the task has no order reference. Distinct from work_unit_id, which for order work is the per-line work unit id.",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "line_no": {
                            "type": "integer",
                            "format": "int32",
                            "minimum": 1,
                            "maximum": 2147483647,
                            "description": "The 1-based order line the completed task's work was released for (copied from WorkReleased.line_no, ADR-0041); with order_ref it lets inventory-storage confirm the pick of exactly that line's reservation. Optional and additive (the event stays v1) and omitted when unknown (transfer work, a release without line_no, or an older task). Never derived from the work_unit_id.",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-18>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-14>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              "examples": [
                {
                  "name": "taskCompleted",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                    "subject": "task-8a1f",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                    "data": {
                      "task_id": "task-8a1f",
                      "station_id": "station-03",
                      "work_unit_id": "wu-8a1f",
                      "associate_id": "worker-42",
                      "duration_seconds": 245,
                      "task_type": "PICK",
                      "order_ref": "order-8a1f",
                      "line_no": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "TaskCPTMissed",
              "title": "TaskCPTMissed",
              "summary": "A task is still open (Pending or Claimed) past its CPT deadline.",
              "description": "Raised by the CPT-missed sweep (`POST /tasks/sweep-cpt-misses`, ADR-0025). Re-fires on every sweep pass while the task stays open past its CPT, so consumers must dedupe on their own (order-management's RepromiseOrder is idempotent by design). Published on `warehouse.fulfillment.events`, keyed by task id. Consumed by order-management.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "promise-feedback"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:TaskCPTMissed:v1",
                        "x-parser-schema-id": "<anonymous-schema-31>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "order_ref",
                          "cpt"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task still open past its CPT.",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The task's order reference.",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN",
                              "DISPATCH",
                              "ARRIVAL"
                            ],
                            "description": "The overdue task's own type; omitted when unknown.",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "cpt": {
                            "type": "string",
                            "description": "The missed CPT deadline.",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-32>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-28>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-27>"
              },
              "examples": [
                {
                  "name": "taskCPTMissed",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                    "subject": "task-8a1f",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCPTMissed:v1",
                    "data": {
                      "task_id": "task-8a1f",
                      "order_ref": "wu-8a1f",
                      "task_type": "PICK",
                      "cpt": "2026-09-30T14:55:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "PackageManifested",
              "title": "PackageManifested",
              "summary": "A package passed its SLAM weigh-check (the \"SLAM pass\").",
              "description": "Raised alongside `LabelApplied` when the SLAM weigh-check passes (ADR-0025); a diverted package does not raise it. Published on `warehouse.fulfillment.events`, keyed by package id. Consumed by order-management.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "promise-feedback"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "order_ref"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Manifested package id.",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The package's order reference.",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-38>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-37>"
              },
              "examples": [
                {
                  "name": "packageManifested",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                    "subject": "pkg-1029",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                    "data": {
                      "package_id": "pkg-1029",
                      "order_ref": "wu-8a1f"
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferPicked",
              "title": "TransferPicked",
              "summary": "A TRANSFER_PICK task completed — transfer stock was picked at the origin site.",
              "description": "Published on `warehouse.fulfillment.events` when a task carrying an inter-warehouse-transfer correlation block with work_kind TRANSFER_PICK completes. Exactly one transfer fact is selected by work_kind at completion (see the transfer-task-facts ADR); non-transfer tasks never publish one. Keyed (and `subject`-ed) by task id, `time` is the completion time. Consumed by the transfer saga (network-inventory-planning) and destination receipt correlation.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "transfer"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferPicked",
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:TransferPicked:v1",
                        "x-parser-schema-id": "<anonymous-schema-49>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "transfer_ref",
                          "work_unit_id",
                          "task_id",
                          "work_kind"
                        ],
                        "description": "The payload every transfer fact (TransferPicked / TransferDispatched / TransferArrived) carries — the transfer correlation block the completed Task carried, stamped at release time.",
                        "properties": {
                          "transfer_ref": {
                            "type": "string",
                            "description": "The transfer saga's correlation id.",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "demand_id": {
                            "type": "string",
                            "description": "The work-demand reference the release carried; omitted when absent.",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "The completed task's work unit id (its order reference).",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "task_id": {
                            "type": "string",
                            "description": "The completing task id — also the Kafka key and CloudEvents subject.",
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          },
                          "work_kind": {
                            "type": "string",
                            "enum": [
                              "TRANSFER_PICK",
                              "TRANSFER_DISPATCH",
                              "TRANSFER_ARRIVAL"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Site the fact is about; omitted when the release carried none.",
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "SKU the transfer moves; omitted when the release carried none.",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "quantity": {
                            "type": "integer",
                            "description": "Units of sku; omitted when the release carried none.",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          }
                        },
                        "x-parser-schema-id": "TransferFactData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-46>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-45>"
              },
              "examples": [
                {
                  "name": "transferPicked",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.transfer.TransferPicked",
                    "subject": "task-tr-8a1f",
                    "time": "2026-10-06T15:04:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TransferPicked:v1",
                    "data": {
                      "transfer_ref": "tr-9f2a",
                      "demand_id": "demand-77",
                      "work_unit_id": "wu-tr-8a1f",
                      "task_id": "task-tr-8a1f",
                      "work_kind": "TRANSFER_PICK",
                      "site_id": "site-north",
                      "sku": "SKU-0042",
                      "quantity": 12
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferDispatched",
              "title": "TransferDispatched",
              "summary": "A TRANSFER_DISPATCH task completed — the transfer left the origin site.",
              "description": "Published on `warehouse.fulfillment.events` when a task carrying an inter-warehouse-transfer correlation block with work_kind TRANSFER_DISPATCH completes. Same envelope and selection rules as TransferPicked.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "transfer"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:TransferDispatched:v1",
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      },
                      "data": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-58>"
              },
              "examples": [
                {
                  "name": "transferDispatched",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched",
                    "subject": "task-tr-8a1f",
                    "time": "2026-10-06T15:04:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TransferDispatched:v1",
                    "data": {
                      "transfer_ref": "tr-9f2a",
                      "demand_id": "demand-77",
                      "work_unit_id": "wu-tr-8a1f",
                      "task_id": "task-tr-8a1f",
                      "work_kind": "TRANSFER_DISPATCH",
                      "site_id": "site-north",
                      "sku": "SKU-0042",
                      "quantity": 12
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferArrived",
              "title": "TransferArrived",
              "summary": "A TRANSFER_ARRIVAL task completed — the transfer reached the destination site.",
              "description": "Published on `warehouse.fulfillment.events` when a task carrying an inter-warehouse-transfer correlation block with work_kind TRANSFER_ARRIVAL completes. Same envelope and selection rules as TransferPicked; destination receipt/stow correlates on transfer_ref.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "transfer"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferArrived",
                        "x-parser-schema-id": "<anonymous-schema-65>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-66>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:events:TransferArrived:v1",
                        "x-parser-schema-id": "<anonymous-schema-67>"
                      },
                      "data": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-64>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-63>"
              },
              "examples": [
                {
                  "name": "transferArrived",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.transfer.TransferArrived",
                    "subject": "task-tr-8a1f",
                    "time": "2026-10-06T15:04:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TransferArrived:v1",
                    "data": {
                      "transfer_ref": "tr-9f2a",
                      "demand_id": "demand-77",
                      "work_unit_id": "wu-tr-8a1f",
                      "task_id": "task-tr-8a1f",
                      "work_kind": "TRANSFER_ARRIVAL",
                      "site_id": "site-south",
                      "sku": "SKU-0042",
                      "quantity": 12
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.fulfillment.analytics": {
      "description": "Internal analytics stream (ADR-0012), keyed by aggregate id; read by this service's own analytics projector.",
      "subscribe": {
        "operationId": "consumeFulfillmentAnalyticsEvents",
        "summary": "Consume Fulfillment Execution analytics events.",
        "description": "Receive every analytics CloudEvent (dataschema `urn:warehouse:fulfillment-execution:analytics:*`).",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "AnalyticsTaskCreated",
              "title": "TaskCreated",
              "summary": "Analytics occurrence of TaskCreated for the throughput data product.",
              "description": "A task entered the pool. Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskCreated",
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:TaskCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task id.",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "The task's process path, enriched via a TaskRepo lookup; empty when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-69>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-68>"
              },
              "examples": [
                {
                  "name": "analyticsTaskCreated",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskCreated",
                    "subject": "t1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:TaskCreated:v1",
                    "data": {
                      "task_id": "t1",
                      "task_type": "PICK"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsTaskClaimed",
              "title": "TaskClaimed",
              "summary": "Analytics occurrence of TaskClaimed for the throughput data product.",
              "description": "A station claimed a task (projects into claims). Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskClaimed",
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-79>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:TaskClaimed:v1",
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type",
                          "station_id"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task id.",
                            "x-parser-schema-id": "<anonymous-schema-82>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "The task's process path, enriched via a TaskRepo lookup; empty when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          },
                          "station_id": {
                            "type": "string",
                            "description": "Station id.",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-81>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-77>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-76>"
              },
              "examples": [
                {
                  "name": "analyticsTaskClaimed",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskClaimed",
                    "subject": "t1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:TaskClaimed:v1",
                    "data": {
                      "task_id": "t1",
                      "task_type": "PICK",
                      "station_id": "s1"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsLeaseExpired",
              "title": "LeaseExpired",
              "summary": "Analytics occurrence of LeaseExpired for the throughput data product.",
              "description": "A claim lease expired (projects into lease expiries). Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.LeaseExpired",
                        "x-parser-schema-id": "<anonymous-schema-87>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:LeaseExpired:v1",
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task id.",
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "The task's process path, enriched via a TaskRepo lookup; empty when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-90>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-86>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-85>"
              },
              "examples": [
                {
                  "name": "analyticsLeaseExpired",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.LeaseExpired",
                    "subject": "t1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:LeaseExpired:v1",
                    "data": {
                      "task_id": "t1",
                      "task_type": "PICK"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsTaskCompleted",
              "title": "TaskCompleted",
              "summary": "Analytics occurrence of TaskCompleted for the throughput data product.",
              "description": "A task was completed (projects into completions). Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                        "x-parser-schema-id": "<anonymous-schema-95>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-96>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:TaskCompleted:v1",
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type",
                          "station_id"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task id.",
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "The task's process path, enriched via a TaskRepo lookup; empty when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-100>"
                          },
                          "station_id": {
                            "type": "string",
                            "description": "Station id.",
                            "x-parser-schema-id": "<anonymous-schema-101>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The order the completed task belongs to; the key inventory-storage uses to confirm picks. Optional and additive (the event stays v1) and omitted when the task has no order reference or cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-102>"
                          },
                          "line_no": {
                            "type": "integer",
                            "format": "int32",
                            "minimum": 1,
                            "maximum": 2147483647,
                            "description": "The 1-based order line the completed task's work was released for (ADR-0041). Optional and additive (the event stays v1) and omitted when unknown or when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-103>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-94>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-93>"
              },
              "examples": [
                {
                  "name": "analyticsTaskCompleted",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                    "subject": "t1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:TaskCompleted:v1",
                    "data": {
                      "task_id": "t1",
                      "task_type": "PICK",
                      "station_id": "s1",
                      "order_ref": "order-1",
                      "line_no": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsItemPicked",
              "title": "ItemPicked",
              "summary": "Analytics occurrence of ItemPicked for the throughput data product.",
              "description": "A Pick task recorded an item retrieval. Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "task"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.task.ItemPicked",
                        "x-parser-schema-id": "<anonymous-schema-106>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-107>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:ItemPicked:v1",
                        "x-parser-schema-id": "<anonymous-schema-108>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "task_id",
                          "task_type"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "description": "Task id.",
                            "x-parser-schema-id": "<anonymous-schema-110>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "The task's process path, enriched via a TaskRepo lookup; empty when the task cannot be found.",
                            "x-parser-schema-id": "<anonymous-schema-111>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-109>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-105>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-104>"
              },
              "examples": [
                {
                  "name": "analyticsItemPicked",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.ItemPicked",
                    "subject": "t1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:ItemPicked:v1",
                    "data": {
                      "task_id": "t1",
                      "task_type": "PICK"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsPackageSealed",
              "title": "PackageSealed",
              "summary": "Analytics occurrence of PackageSealed for the throughput data product.",
              "description": "A package was sealed. Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.PackageSealed",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-115>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:PackageSealed:v1",
                        "x-parser-schema-id": "<anonymous-schema-116>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Package id.",
                            "x-parser-schema-id": "<anonymous-schema-118>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-117>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-113>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-112>"
              },
              "examples": [
                {
                  "name": "analyticsPackageSealed",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageSealed",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:PackageSealed:v1",
                    "data": {
                      "package_id": "p1"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsWeightDiscrepancyDetected",
              "title": "WeightDiscrepancyDetected",
              "summary": "Analytics occurrence of WeightDiscrepancyDetected for the throughput data product.",
              "description": "SLAM found the weight out of tolerance (projects into SLAM diverts). Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.WeightDiscrepancyDetected",
                        "x-parser-schema-id": "<anonymous-schema-121>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-122>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:WeightDiscrepancyDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "expected_g",
                          "actual_g"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Package id.",
                            "x-parser-schema-id": "<anonymous-schema-125>"
                          },
                          "expected_g": {
                            "type": "number",
                            "description": "Expected weight.",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "actual_g": {
                            "type": "number",
                            "description": "Measured weight.",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-120>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-119>"
              },
              "examples": [
                {
                  "name": "analyticsWeightDiscrepancyDetected",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.WeightDiscrepancyDetected",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:WeightDiscrepancyDetected:v1",
                    "data": {
                      "package_id": "p1",
                      "expected_g": 1000,
                      "actual_g": 1200
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsLabelApplied",
              "title": "LabelApplied",
              "summary": "Analytics occurrence of LabelApplied for the throughput data product.",
              "description": "SLAM applied the shipping label. Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.LabelApplied",
                        "x-parser-schema-id": "<anonymous-schema-130>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-131>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:LabelApplied:v1",
                        "x-parser-schema-id": "<anonymous-schema-132>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Package id.",
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-133>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-129>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-128>"
              },
              "examples": [
                {
                  "name": "analyticsLabelApplied",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.LabelApplied",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:LabelApplied:v1",
                    "data": {
                      "package_id": "p1"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsPackageDiverted",
              "title": "PackageDiverted",
              "summary": "Analytics occurrence of PackageDiverted for the throughput data product.",
              "description": "A package was diverted off the standard path. Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.PackageDiverted",
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-138>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:PackageDiverted:v1",
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Package id.",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-140>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-136>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-135>"
              },
              "examples": [
                {
                  "name": "analyticsPackageDiverted",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageDiverted",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:PackageDiverted:v1",
                    "data": {
                      "package_id": "p1"
                    }
                  }
                }
              ]
            },
            {
              "name": "AnalyticsPackageManifested",
              "title": "PackageManifested",
              "summary": "Analytics occurrence of PackageManifested for the throughput data product.",
              "description": "A package passed SLAM (projects into the on-time-to-CPT KPI). Published on the internal `warehouse.fulfillment.analytics` topic (ADR-0012) and consumed only by this service's own analytics projector (`cmd/fulfillment-projector`).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "package"
                },
                {
                  "name": "analytics"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                        "x-parser-schema-id": "<anonymous-schema-144>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-145>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:fulfillment-execution:analytics:PackageManifested:v1",
                        "x-parser-schema-id": "<anonymous-schema-146>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "order_ref",
                          "task_type",
                          "station_id",
                          "on_time",
                          "resolved"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "description": "Package id.",
                            "x-parser-schema-id": "<anonymous-schema-148>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The package's order reference.",
                            "x-parser-schema-id": "<anonymous-schema-149>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "",
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "description": "Originating SLAM task type; empty when unresolved.",
                            "x-parser-schema-id": "<anonymous-schema-150>"
                          },
                          "station_id": {
                            "type": "string",
                            "description": "Originating SLAM station; empty when unresolved.",
                            "x-parser-schema-id": "<anonymous-schema-151>"
                          },
                          "on_time": {
                            "type": "boolean",
                            "description": "Manifested at or before the originating SLAM task's CPT (ADR-0026).",
                            "x-parser-schema-id": "<anonymous-schema-152>"
                          },
                          "resolved": {
                            "type": "boolean",
                            "description": "Whether the originating SLAM task could be resolved; when false the projector skips recording.",
                            "x-parser-schema-id": "<anonymous-schema-153>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-147>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-143>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-142>"
              },
              "examples": [
                {
                  "name": "analyticsPackageManifested",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:analytics:PackageManifested:v1",
                    "data": {
                      "package_id": "p1",
                      "order_ref": "wu-8a1f",
                      "task_type": "SLAM",
                      "station_id": "station-09",
                      "on_time": true,
                      "resolved": true
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.work-planning.events": {
      "description": "wes-work-planning's integration topic; this service consumes WorkReleased from it (consumer group `WORK_RELEASED_CONSUMER_GROUP`, default `fulfillment-execution`).",
      "publish": {
        "operationId": "receiveWorkReleased",
        "summary": "Receive WorkReleased from wes-work-planning.",
        "description": "wes-work-planning publishes WorkReleased here; this service creates a Task for each new CloudEvents id.",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "WorkReleased",
          "title": "WorkReleased",
          "summary": "Work Planning released a work unit (consumed).",
          "description": "Published by wes-work-planning on `warehouse.work-planning.events`; consumed here to create a Task via CreateTask. Dispatch is on the full `type`; dedupe is on the CloudEvents `id`. A message that is not a valid CloudEvents 1.0 event is dead-lettered to `warehouse.work-planning.events.dlq`.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "required": [
                  "type",
                  "source",
                  "dataschema",
                  "data"
                ],
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/wes-work-planning",
                    "x-parser-schema-id": "<anonymous-schema-157>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                    "x-parser-schema-id": "<anonymous-schema-158>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "path_id",
                      "work_unit_id",
                      "cpt"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "description": "Process path id, resolved against the process-path catalogue.",
                        "x-parser-schema-id": "<anonymous-schema-160>"
                      },
                      "work_unit_id": {
                        "type": "string",
                        "description": "Becomes the Task's order reference.",
                        "x-parser-schema-id": "<anonymous-schema-161>"
                      },
                      "cpt": {
                        "type": "string",
                        "description": "CPT deadline.",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-162>"
                      },
                      "ref": {
                        "type": "string",
                        "description": "Release reference. For order-originated work this is the order id; it is kept on the Task and published as TaskCompleted.order_ref (ADR-0040). For transfer work it is the demand id.",
                        "x-parser-schema-id": "<anonymous-schema-163>"
                      },
                      "line_no": {
                        "type": "integer",
                        "format": "int32",
                        "minimum": 1,
                        "maximum": 2147483647,
                        "description": "Optional (additive; the event stays v1). The 1-based order line this work unit is for; wes-work-planning sets it for order-originated work (explicitly, not encoded in work_unit_id). It is kept on the Task as source_line_no and published as TaskCompleted.line_no (ADR-0041). Absent from producers that predate it, and never honoured for transfer work. A value above 2147483647 (the 32-bit column width) is ignored by this consumer rather than rejected, so the task is still created with its line unknown.",
                        "x-parser-schema-id": "<anonymous-schema-164>"
                      },
                      "fragile": {
                        "type": "boolean",
                        "description": "Optional fragile packing hint (default false).",
                        "x-parser-schema-id": "<anonymous-schema-165>"
                      },
                      "gift_wrap": {
                        "type": "boolean",
                        "description": "Optional gift-wrap request (default false).",
                        "x-parser-schema-id": "<anonymous-schema-166>"
                      },
                      "transfer_ref": {
                        "type": "string",
                        "description": "Present only for inter-warehouse-transfer work (the transfer saga's correlation id). Its presence turns the created Task into transfer work whose completion publishes exactly one transfer fact.",
                        "x-parser-schema-id": "<anonymous-schema-167>"
                      },
                      "work_kind": {
                        "type": "string",
                        "enum": [
                          "TRANSFER_PICK",
                          "TRANSFER_DISPATCH",
                          "TRANSFER_ARRIVAL"
                        ],
                        "description": "Kind of transfer work; selects the completion fact. Required whenever transfer_ref is present, unknown values are rejected.",
                        "x-parser-schema-id": "<anonymous-schema-168>"
                      },
                      "site_id": {
                        "type": "string",
                        "description": "Site the transfer fact is about (origin for pick/dispatch, destination for arrival).",
                        "x-parser-schema-id": "<anonymous-schema-169>"
                      },
                      "sku": {
                        "type": "string",
                        "description": "SKU the transfer moves.",
                        "x-parser-schema-id": "<anonymous-schema-170>"
                      },
                      "quantity": {
                        "type": "integer",
                        "description": "Units of sku the transfer moves.",
                        "x-parser-schema-id": "<anonymous-schema-171>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-159>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-155>"
              }
            ],
            "x-parser-schema-id": "<anonymous-schema-154>"
          },
          "examples": [
            {
              "name": "workReleased",
              "headers": {
                "content-type": "application/cloudevents+json; charset=UTF-8",
                "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
              },
              "payload": {
                "specversion": "1.0",
                "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                "source": "/warehouse/wes-work-planning",
                "type": "com.warehouse.wes.work-planning.workunit.WorkReleased",
                "subject": "wu-8a1f",
                "time": "2026-09-30T15:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:wes-work-planning:events:WorkReleased:v1",
                "data": {
                  "path_id": "pick-zone-a",
                  "work_unit_id": "wu-8a1f",
                  "cpt": "2026-09-30T18:00:00Z",
                  "ref": "release-1",
                  "line_no": 2
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.process-path-management.events": {
      "description": "process-path-management's integration topic; this service replays ProcessPath* events into its local catalogue.",
      "publish": {
        "operationId": "receiveProcessPathEvents",
        "summary": "Receive process-path catalogue events.",
        "description": "process-path-management publishes ProcessPath* CloudEvents here; this service applies them to its in-memory catalogue.",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "ProcessPathCreated",
              "summary": "Process-path catalogue event ProcessPathCreated (consumed).",
              "description": "Published by process-path-management on `warehouse.process-path-management.events`; replayed from FirstOffset into the in-memory process-path catalogue when `PATH_CATALOGUE_SOURCE=kafka`. A message that is not a valid CloudEvents 1.0 event is logged at WARN and skipped.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                        "x-parser-schema-id": "<anonymous-schema-174>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-175>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-176>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Process path id.",
                            "x-parser-schema-id": "<anonymous-schema-178>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "description": "Case-insensitive path_id prefix this path matches.",
                            "x-parser-schema-id": "<anonymous-schema-179>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Direct (non-sortable) path.",
                            "x-parser-schema-id": "<anonymous-schema-180>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-182>"
                            },
                            "description": "Station capabilities required.",
                            "x-parser-schema-id": "<anonymous-schema-181>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "Optional destination location role.",
                            "x-parser-schema-id": "<anonymous-schema-183>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-177>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-173>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-172>"
              },
              "examples": [
                {
                  "name": "processPathCreated",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "PICK",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [
                        "pick"
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathUpdated",
              "title": "ProcessPathUpdated",
              "summary": "Process-path catalogue event ProcessPathUpdated (consumed).",
              "description": "Published by process-path-management on `warehouse.process-path-management.events`; replayed from FirstOffset into the in-memory process-path catalogue when `PATH_CATALOGUE_SOURCE=kafka`. A message that is not a valid CloudEvents 1.0 event is logged at WARN and skipped.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                        "x-parser-schema-id": "<anonymous-schema-186>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-187>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-188>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Process path id.",
                            "x-parser-schema-id": "<anonymous-schema-190>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "description": "Case-insensitive path_id prefix this path matches.",
                            "x-parser-schema-id": "<anonymous-schema-191>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Direct (non-sortable) path.",
                            "x-parser-schema-id": "<anonymous-schema-192>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-194>"
                            },
                            "description": "Station capabilities required.",
                            "x-parser-schema-id": "<anonymous-schema-193>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "Optional destination location role.",
                            "x-parser-schema-id": "<anonymous-schema-195>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-189>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-185>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-184>"
              },
              "examples": [
                {
                  "name": "processPathUpdated",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "subject": "PICK",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [
                        "pick",
                        "hazmat"
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "ProcessPathDeactivated",
              "summary": "Process-path catalogue event ProcessPathDeactivated (consumed).",
              "description": "Published by process-path-management on `warehouse.process-path-management.events`; replayed from FirstOffset into the in-memory process-path catalogue when `PATH_CATALOGUE_SOURCE=kafka`. A message that is not a valid CloudEvents 1.0 event is logged at WARN and skipped.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "source",
                      "dataschema",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                        "x-parser-schema-id": "<anonymous-schema-198>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-199>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                        "x-parser-schema-id": "<anonymous-schema-200>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "Process path id.",
                            "x-parser-schema-id": "<anonymous-schema-202>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "description": "Case-insensitive path_id prefix this path matches.",
                            "x-parser-schema-id": "<anonymous-schema-203>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "Direct (non-sortable) path.",
                            "x-parser-schema-id": "<anonymous-schema-204>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-206>"
                            },
                            "description": "Station capabilities required.",
                            "x-parser-schema-id": "<anonymous-schema-205>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "Optional destination location role.",
                            "x-parser-schema-id": "<anonymous-schema-207>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-201>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-197>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-196>"
              },
              "examples": [
                {
                  "name": "processPathDeactivated",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8",
                    "traceparent": "00-8812c36621d214139a08949823716b93-14ddf02dbd8913ba-01"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "subject": "PICK",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                    "data": {
                      "path_id": "PICK"
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
      "description": "product-master's integration topic (key and `subject` = SKU). This service consumes only ProductClassified from it, into its local classification copy (ADR-0039), under the consumer group from `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`, only when `PRODUCT_CLASSIFICATION_MODE=kafka`. Every other type on the topic (ProductRegistered, ProductDescriptionChanged, ProductDimensionsDeclared, ProductMeasured) is ignored.",
      "publish": {
        "operationId": "receiveProductClassified",
        "summary": "Receive ProductClassified from product-master.",
        "description": "product-master publishes the full classification of a SKU here. The CloudEvents `id` claim and the version-guarded upsert of `product_classification_copy` commit in one transaction; the offset is committed afterwards. A message is applied only when its `version` is greater than the stored one. A message that is not a valid CloudEvent, or whose payload breaks the contract, is logged at WARN and skipped. SealPackage reads the copy for its DOT hazard segregation check.",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "ProductClassified",
          "title": "ProductClassified",
          "summary": "product-master set or replaced a SKU's handling classification (consumed).",
          "description": "Published by product-master on `warehouse.product-master.events` (its AsyncAPI is the source of truth); consumed here into the local classification copy (ADR-0039). Full-state replacement of the classification; optional fields are omitted when unset. Applied only when `version` is greater than the stored version; dedupe on the CloudEvents `id`.",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "headers": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "required": [
                  "type",
                  "source",
                  "dataschema",
                  "data"
                ],
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.product-master.product.ProductClassified",
                    "x-parser-schema-id": "<anonymous-schema-210>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/product-master",
                    "x-parser-schema-id": "<anonymous-schema-211>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:product-master:events:ProductClassified:v1",
                    "x-parser-schema-id": "<anonymous-schema-212>"
                  },
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
                        "description": "The SKU (also the Kafka key and the CloudEvents `subject`).",
                        "x-parser-schema-id": "<anonymous-schema-214>"
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
                          "x-parser-schema-id": "<anonymous-schema-216>"
                        },
                        "description": "Handling tags in stable order. Hazmat and Fragile feed ClassificationInfo; the others are stored but unused here.",
                        "x-parser-schema-id": "<anonymous-schema-215>"
                      },
                      "temperature_class": {
                        "type": "string",
                        "enum": [
                          "Ambient",
                          "Chilled",
                          "Frozen"
                        ],
                        "description": "Omitted when unset.",
                        "x-parser-schema-id": "<anonymous-schema-217>"
                      },
                      "dot_hazard_class": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 9,
                        "description": "DOT hazard class; omitted when unset. Drives SealPackage's same-package segregation (ADR-0010).",
                        "x-parser-schema-id": "<anonymous-schema-218>"
                      },
                      "classification_source": {
                        "type": "string",
                        "enum": [
                          "native",
                          "legacy-import"
                        ],
                        "description": "Migration artefact of product-master (its ADR 0003); not used here.",
                        "x-parser-schema-id": "<anonymous-schema-219>"
                      },
                      "version": {
                        "type": "integer",
                        "minimum": 1,
                        "format": "int64",
                        "description": "Product aggregate version after the change; the local copy's guard.",
                        "x-parser-schema-id": "<anonymous-schema-220>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-213>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-209>"
              }
            ],
            "x-parser-schema-id": "<anonymous-schema-208>"
          },
          "examples": [
            {
              "name": "productClassified",
              "headers": {
                "content-type": "application/cloudevents+json; charset=UTF-8"
              },
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
        }
      }
    }
  },
  "components": {
    "messages": {
      "TaskCompleted": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0]",
      "TaskCPTMissed": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[1]",
      "PackageManifested": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[2]",
      "AnalyticsTaskCreated": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[0]",
      "AnalyticsTaskClaimed": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[1]",
      "AnalyticsLeaseExpired": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[2]",
      "AnalyticsTaskCompleted": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[3]",
      "AnalyticsItemPicked": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[4]",
      "AnalyticsPackageSealed": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[5]",
      "AnalyticsWeightDiscrepancyDetected": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[6]",
      "AnalyticsLabelApplied": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[7]",
      "AnalyticsPackageDiverted": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[8]",
      "AnalyticsPackageManifested": "$ref:$.channels.warehouse.fulfillment.analytics.subscribe.message.oneOf[9]",
      "WorkReleased": "$ref:$.channels.warehouse.work-planning.events.publish.message",
      "TransferPicked": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[3]",
      "TransferDispatched": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[4]",
      "TransferArrived": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[5]",
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2]",
      "ProductClassified": "$ref:$.channels.warehouse.product-master.events.publish.message"
    },
    "schemas": {
      "TransferFactData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "KafkaHeaders": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].headers",
      "CloudEvent": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]"
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
  