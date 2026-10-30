
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "exception-management Domain Events",
    "version": "1.0.0",
    "contact": {
      "name": "exception-management maintainers",
      "url": "https://github.com/IQVO/exception-management",
      "email": "exception-management@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event catalog for the **exception-management** bounded context (WES\nsubdomain): the Problem Solve lifecycle (ADR 0001, ADR 0002). Every case\nis opened by a fact another context published; this service owns the\ntriage, assignment, SLA and resolution of that case, never the producer's\nown state.\n\n**Published.** The `ExceptionCase` aggregate raises six events and the\n`ExceptionPolicy` aggregate one, all published to\n`warehouse.exception-management.events` through a **transactional\noutbox**: the aggregate row and its already-encoded events are written in\nONE database transaction and a relay drains them to Kafka (at-least-once;\nthe CloudEvents `id` is stored with the outbox row, so a retry republishes\nthe same `id`). Kafka key = case id (source type for the policy event), so\none case's history stays ordered on one partition.\n\n**Consumed (ADR 0003, 0006).** Exception facts from seven sibling contexts:\nfulfillment-execution (`TaskCPTMissed`, `PackageDiverted`,\n`WeightDiscrepancyDetected`), wes-work-planning\n(`BacklogThresholdBreached`), network-fulfillment\n(`AcknowledgementDeadlineAtRisk`, `OrphanedHoldCancelled`),\norder-management (`OrderRepromised`, correlation for auto-resolve only),\nreturns-processing (`UnexpectedReturnReceived`), inbound-receiving\n(`CartonDiscrepancyRaised`, routed by `kind`, ADR 0006) and inventory-storage\n(`DiscrepancyDetected`, `ItemUnlocated`). Each consumed message opens or\ntouches exactly one open case per dedup key (source type, source subject,\nsite); the source payload is frozen on the case, never re-fetched. The\nconsumed messages below are the producers' own contracts, restated here\nand never imported.\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\n`specversion`, `id`, `source` (`/warehouse/exception-management`), `type`,\n`subject` (the case id; the source type for the policy event), `time`,\n`datacontenttype` (`application/json`) and `dataschema`\n(`urn:warehouse:exception-management:events:<EventName>:v1`) are all\nrequired. Kafka key = the subject. Type =\n`com.warehouse.wes.exception-management.<entity>.<EventName>`. A breaking\npayload change is a new `.v2` type, never a mutation.\n"
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
      "name": "exception-management",
      "description": "The exception-management bounded context (WES subdomain)."
    },
    {
      "name": "exceptioncase",
      "description": "Events raised by the ExceptionCase aggregate."
    },
    {
      "name": "exceptionpolicy",
      "description": "Events raised by the ExceptionPolicy aggregate."
    },
    {
      "name": "analytics",
      "description": "The analytics read side of this context (ADR 0006): the analytics topic, its projector and the reports binary."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes (ADR 0003)."
    }
  ],
  "channels": {
    "warehouse.exception-management.events": {
      "description": "This service's integration topic. Written by the outbox relay; key = case\nid (source type for the policy event); every message carries the\nCloudEvents content-type header (plus the optional W3C `traceparent` of\nthe writing request). Dispatch on the full `type`, ignore unknown types,\ndedupe on `id`.\n",
      "subscribe": {
        "operationId": "receiveExceptionEvents",
        "summary": "Receive ExceptionCase and ExceptionPolicy events.",
        "description": "Subscribe to the case lifecycle. Route on the full `type`\n(`com.warehouse.wes.exception-management.exceptioncase.<EventName>`).\n`ExceptionOpened` announces a case (with its frozen source payload);\n`ExceptionTriaged`, `ExceptionAssigned` and `ExceptionEscalated` are\noperator/sweeper facts; `ExceptionResolved` and\n`ExceptionAutoResolved` are terminal. `ExceptionPolicyDeclared` (key\nand subject = the source type) announces a policy version.\n",
        "tags": [
          {
            "name": "exceptioncase"
          }
        ],
        "message": {
          "oneOf": [
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionOpened",
              "title": "Exception opened",
              "summary": "A source fact created a case (first occurrence of the dedup key).",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionOpened`;\nsubject and key = the case id. `sla_due_at` is `opened_at` plus the\npolicy's `sla_minutes` for the source type. `source_payload` is the\nfrozen copy of the producer's `data` exactly as consumed: it never\nchanges after open and is never re-fetched. `site_id` is null when the\nsource event carries no site.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
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
                        "description": "The aggregate instance id (the case id for case events; the source type for the policy event).",
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
                          "case_id",
                          "source_type",
                          "source_subject",
                          "site_id",
                          "severity",
                          "queue",
                          "opened_at",
                          "sla_due_at",
                          "source_event_id",
                          "source_payload"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-11>"
                          },
                          "source_type": {
                            "type": "string",
                            "description": "The full CloudEvents type of the consumed source fact.",
                            "x-parser-schema-id": "<anonymous-schema-12>"
                          },
                          "source_subject": {
                            "type": "string",
                            "description": "The subject of the consumed source fact (its aggregate id).",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "site_id": {
                            "type": "string",
                            "nullable": true,
                            "description": "The site carried by the source fact; null when it has none.",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "severity": {
                            "type": "string",
                            "enum": [
                              "LOW",
                              "MEDIUM",
                              "HIGH",
                              "CRITICAL"
                            ],
                            "description": "The policy default at open.",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "queue": {
                            "type": "string",
                            "description": "The problem-solve queue the policy routes the case to.",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "opened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "sla_due_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "opened_at + the policy's sla_minutes.",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "source_event_id": {
                            "type": "string",
                            "description": "The CloudEvents id of the source fact that opened the case.",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "source_payload": {
                            "type": "object",
                            "description": "Frozen copy of the source fact's data; never changes after open.",
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "ExceptionOpenedEvent"
              },
              "examples": [
                {
                  "name": "opened",
                  "summary": "A TaskCPTMissed fact opened the case for task task-8a1f.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f2a9c1e-6b48-4d17-9a0f-8e5d2c7b4a11",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionOpened",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:00:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionOpened:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "source_type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                      "source_subject": "task-8a1f",
                      "site_id": null,
                      "severity": "HIGH",
                      "queue": "cps-front",
                      "opened_at": "2026-10-21T09:00:05Z",
                      "sla_due_at": "2026-10-21T09:30:05Z",
                      "source_event_id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                      "source_payload": {
                        "task_id": "task-8a1f",
                        "order_ref": "wu-8a1f",
                        "task_type": "PICK",
                        "cpt": "2026-09-30T14:55:00Z"
                      }
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionTriaged",
              "title": "Exception triaged",
              "summary": "Severity and queue were set (policy default or operator).",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionTriaged`;\nsubject and key = the case id. `actor` is the operator id or `system`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "case_id",
                          "severity",
                          "queue",
                          "actor",
                          "at"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "severity": {
                            "type": "string",
                            "enum": [
                              "LOW",
                              "MEDIUM",
                              "HIGH",
                              "CRITICAL"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "queue": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "actor": {
                            "type": "string",
                            "description": "The operator id or `system`.",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-21>"
                  }
                ],
                "x-parser-schema-id": "ExceptionTriagedEvent"
              },
              "examples": [
                {
                  "name": "triaged",
                  "summary": "An operator moved the case to the inbound queue at high severity.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c4b2d8f-1a39-4e60-8b2d-7f6e5a4b3c22",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionTriaged",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionTriaged:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "severity": "CRITICAL",
                      "queue": "cps-inbound",
                      "actor": "op-jane",
                      "at": "2026-10-21T09:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionAssigned",
              "title": "Exception assigned",
              "summary": "An owner took the case.",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionAssigned`;\nsubject and key = the case id. `assignee` is the operator id now\nowning the case; `actor` is who performed the assignment.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "case_id",
                          "assignee",
                          "actor",
                          "at"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          },
                          "assignee": {
                            "type": "string",
                            "description": "The operator id now owning the case.",
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "actor": {
                            "type": "string",
                            "description": "The operator id or `system` that performed the assignment.",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-28>"
                  }
                ],
                "x-parser-schema-id": "ExceptionAssignedEvent"
              },
              "examples": [
                {
                  "name": "assigned",
                  "summary": "op-marc took the case.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e8f9a0b-2c4d-4e5f-8a9b-0c1d2e3f4a33",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionAssigned",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionAssigned:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "assignee": "op-marc",
                      "actor": "op-jane",
                      "at": "2026-10-21T09:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionEscalated",
              "title": "Exception escalated",
              "summary": "The SLA clock breached; the ESCALATED flag was set (work continues).",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionEscalated`;\nsubject and key = the case id. Raised once by the bounded SLA sweeper\nwhen `now` passes `sla_due_at` while the case is not resolved. The\nflag never blocks a transition and is not a state (ADR 0002).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "case_id",
                          "sla_due_at",
                          "at"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "sla_due_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-35>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-34>"
                  }
                ],
                "x-parser-schema-id": "ExceptionEscalatedEvent"
              },
              "examples": [
                {
                  "name": "escalated",
                  "summary": "The case breached its 30-minute SLA.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c44",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionEscalated",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:30:06Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionEscalated:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "sla_due_at": "2026-10-21T09:30:05Z",
                      "at": "2026-10-21T09:30:06Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionResolved",
              "title": "Exception resolved",
              "summary": "A resolution code and root cause were recorded; the case is terminal.",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionResolved`;\nsubject and key = the case id. `resolution_code` and `root_cause` are\nmandatory; `note` is a free-form nullable remark. `actor` is the\noperator id. After this the case accepts no command (409-class error).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "case_id",
                          "resolution_code",
                          "root_cause",
                          "note",
                          "actor",
                          "at"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "resolution_code": {
                            "type": "string",
                            "description": "What was done about the case (a code",
                            "not prose).": null,
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "root_cause": {
                            "type": "string",
                            "description": "Why it happened (a code",
                            "not prose).": null,
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "note": {
                            "type": "string",
                            "nullable": true,
                            "description": "Free-form remark; null when none.",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "actor": {
                            "type": "string",
                            "description": "The operator id that resolved the case.",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-39>"
                  }
                ],
                "x-parser-schema-id": "ExceptionResolvedEvent"
              },
              "examples": [
                {
                  "name": "resolved",
                  "summary": "The task was re-run and the promise restored.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1f2e3d4c-5b6a-4789-9abc-def012345678",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionResolved",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:25:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionResolved:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "resolution_code": "WORK_COMPLETED",
                      "root_cause": "OPERATOR_UNAVAILABLE",
                      "note": null,
                      "actor": "op-marc",
                      "at": "2026-10-21T09:25:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "case lifecycle fact; console and ops-agent read cases via REST; no event consumer in v1",
              "name": "ExceptionAutoResolved",
              "title": "Exception auto-resolved",
              "summary": "A declarative policy rule closed the case on a correlated fact.",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptioncase.ExceptionAutoResolved`;\nsubject and key = the case id. `rule_id` names the policy's\nauto-resolve rule that fired; `correlated_type` and\n`correlated_event_id` are the full CloudEvents type and id of the\ncorrelated fact that satisfied the rule (for example an\n`OrderRepromised` for the same work unit within the window).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptioncase"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "case_id",
                          "rule_id",
                          "correlated_type",
                          "correlated_event_id",
                          "at"
                        ],
                        "properties": {
                          "case_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "rule_id": {
                            "type": "string",
                            "description": "The policy's auto-resolve rule that fired.",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "correlated_type": {
                            "type": "string",
                            "description": "The full CloudEvents type of the correlated fact.",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "correlated_event_id": {
                            "type": "string",
                            "description": "The CloudEvents id of the correlated fact.",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-47>"
                  }
                ],
                "x-parser-schema-id": "ExceptionAutoResolvedEvent"
              },
              "examples": [
                {
                  "name": "autoResolved",
                  "summary": "The repromised order closed the CPT-miss case.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2e3f4a5b-6c7d-4899-a0bc-def012345678",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionAutoResolved",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:20:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionAutoResolved:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "rule_id": "cpt-missed-repromised-v1",
                      "correlated_type": "com.warehouse.wes.order-management.order.OrderRepromised",
                      "correlated_event_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
                      "at": "2026-10-21T09:20:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "policy declaration fact (append-only versions); no event consumer in v1",
              "name": "ExceptionPolicyDeclared",
              "title": "Exception policy declared",
              "summary": "A new version of the handling policy of a source type.",
              "description": "`type` = `com.warehouse.wes.exception-management.exceptionpolicy.ExceptionPolicyDeclared`;\nsubject and key = the source type (the full CloudEvents type string of\nthe consumed source event the policy governs). Policies are\nappend-only versions; the new version governs cases opened afterwards.\n`auto_resolve` is null when the source type has no auto-resolve rule.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "exceptionpolicy"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "source_type",
                          "version",
                          "severity",
                          "queue",
                          "sla_minutes",
                          "auto_resolve"
                        ],
                        "properties": {
                          "source_type": {
                            "type": "string",
                            "description": "The full CloudEvents type of the governed source fact.",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Append-only: 1 for the first declaration, +1 per accepted change.",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "severity": {
                            "type": "string",
                            "enum": [
                              "LOW",
                              "MEDIUM",
                              "HIGH",
                              "CRITICAL"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "queue": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          },
                          "sla_minutes": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "The SLA budget of cases opened under this policy.",
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          },
                          "auto_resolve": {
                            "type": "object",
                            "nullable": true,
                            "allOf": [
                              {
                                "type": "object",
                                "required": [
                                  "on_type",
                                  "within_minutes"
                                ],
                                "properties": {
                                  "on_type": {
                                    "type": "string",
                                    "description": "The full CloudEvents type of the correlated fact that closes the case (e.g. OrderRepromised).",
                                    "x-parser-schema-id": "<anonymous-schema-62>"
                                  },
                                  "within_minutes": {
                                    "type": "integer",
                                    "minimum": 1,
                                    "description": "The correlated fact counts only within this many minutes of the case's last occurrence.",
                                    "x-parser-schema-id": "<anonymous-schema-63>"
                                  }
                                },
                                "x-parser-schema-id": "AutoResolveRule"
                              }
                            ],
                            "x-parser-schema-id": "<anonymous-schema-61>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-54>"
                  }
                ],
                "x-parser-schema-id": "ExceptionPolicyDeclaredEvent"
              },
              "examples": [
                {
                  "name": "declared",
                  "summary": "TaskCPTMissed defaults to HIGH, cps-front, 30-minute SLA, repromise auto-resolve.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a5b6c7d-8e9f-4a0b-8c1d-2e3f4a5b6c55",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptionpolicy.ExceptionPolicyDeclared",
                    "subject": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                    "time": "2026-10-21T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:events:ExceptionPolicyDeclared:v1",
                    "data": {
                      "source_type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                      "version": 1,
                      "severity": "HIGH",
                      "queue": "cps-front",
                      "sla_minutes": 30,
                      "auto_resolve": {
                        "on_type": "com.warehouse.wes.order-management.order.OrderRepromised",
                        "within_minutes": 60
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.exception-management.analytics": {
      "description": "This service's own analytics stream (ADR 0006), written by the SAME\ntransactional outbox relay as the integration topic: every published\nfact appears here too, under the SAME CloudEvents id and `type`, with\nonly the `dataschema` stream segment different\n(urn:warehouse:exception-management:analytics:<EventName>:v1). It is NOT\nan integration contract: the only consumer is this service's\ncmd/exceptions-projector (fixed group from `ANALYTICS_CONSUMER_GROUP`,\nstarting at the earliest retained offset), which folds the events into\nthe analytical database; its deterministic poison goes to\nwarehouse.exception-management.analytics.dlq. Other contexts keep\nreading warehouse.exception-management.events.\n",
      "subscribe": {
        "operationId": "receiveExceptionAnalytics",
        "summary": "Receive the analytics twin of every published fact.",
        "description": "Payloads are byte-for-byte the integration payloads (ADR 0006); only\nthe dataschema names the analytics stream. The projector answers the\nroot-cause-frequency, mean-time-to-resolve, sla-breach-rate and\nfreshness reports from the folded facts.\n",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ExceptionOpened",
              "title": "Exception opened (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionOpened (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionOpened:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload",
              "examples": [
                {
                  "name": "opened",
                  "summary": "A TaskCPTMissed fact opened the case for task task-8a1f.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f2a9c1e-6b48-4d17-9a0f-8e5d2c7b4a11",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionOpened",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:00:05Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionOpened:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "source_type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                      "source_subject": "task-8a1f",
                      "site_id": null,
                      "severity": "HIGH",
                      "queue": "cps-front",
                      "opened_at": "2026-10-21T09:00:05Z",
                      "sla_due_at": "2026-10-21T09:30:05Z",
                      "source_event_id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                      "source_payload": {
                        "task_id": "task-8a1f",
                        "order_ref": "wu-8a1f",
                        "task_type": "PICK",
                        "cpt": "2026-09-30T14:55:00Z"
                      }
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionTriaged",
              "title": "Exception triaged (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionTriaged (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionTriaged:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[1].payload",
              "examples": [
                {
                  "name": "triaged",
                  "summary": "An operator moved the case to the inbound queue at high severity.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c4b2d8f-1a39-4e60-8b2d-7f6e5a4b3c22",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionTriaged",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionTriaged:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "severity": "CRITICAL",
                      "queue": "cps-inbound",
                      "actor": "op-jane",
                      "at": "2026-10-21T09:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionAssigned",
              "title": "Exception assigned (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionAssigned (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionAssigned:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[2].payload",
              "examples": [
                {
                  "name": "assigned",
                  "summary": "op-marc took the case.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e8f9a0b-2c4d-4e5f-8a9b-0c1d2e3f4a33",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionAssigned",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionAssigned:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "assignee": "op-marc",
                      "actor": "op-jane",
                      "at": "2026-10-21T09:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionEscalated",
              "title": "Exception escalated (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionEscalated (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionEscalated:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[3].payload",
              "examples": [
                {
                  "name": "escalated",
                  "summary": "The case breached its 30-minute SLA.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c44",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionEscalated",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:30:06Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionEscalated:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "sla_due_at": "2026-10-21T09:30:05Z",
                      "at": "2026-10-21T09:30:06Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionResolved",
              "title": "Exception resolved (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionResolved (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionResolved:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[4].payload",
              "examples": [
                {
                  "name": "resolved",
                  "summary": "The task was re-run and the promise restored.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1f2e3d4c-5b6a-4789-9abc-def012345678",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionResolved",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:25:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionResolved:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "resolution_code": "WORK_COMPLETED",
                      "root_cause": "OPERATOR_UNAVAILABLE",
                      "note": null,
                      "actor": "op-marc",
                      "at": "2026-10-21T09:25:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionAutoResolved",
              "title": "Exception auto-resolved (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionAutoResolved (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionAutoResolved:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[5].payload",
              "examples": [
                {
                  "name": "autoResolved",
                  "summary": "The repromised order closed the CPT-miss case.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2e3f4a5b-6c7d-4899-a0bc-def012345678",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionAutoResolved",
                    "subject": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                    "time": "2026-10-21T09:20:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionAutoResolved:v1",
                    "data": {
                      "case_id": "case-1d2e3f4a-5b6c-4789-9abc-def012345678",
                      "rule_id": "cpt-missed-repromised-v1",
                      "correlated_type": "com.warehouse.wes.order-management.order.OrderRepromised",
                      "correlated_event_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
                      "at": "2026-10-21T09:20:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ExceptionPolicyDeclared",
              "title": "Exception policy declared (analytics twin)",
              "summary": "The analytics-stream twin of ExceptionPolicyDeclared (ADR 0006).",
              "description": "Same `type`, `id`, `subject`, key and payload as the integration message; `dataschema` = `urn:warehouse:exception-management:analytics:ExceptionPolicyDeclared:v1`. Consumed only by cmd/exceptions-projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[6].payload",
              "examples": [
                {
                  "name": "declared",
                  "summary": "TaskCPTMissed defaults to HIGH, cps-front, 30-minute SLA, repromise auto-resolve.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a5b6c7d-8e9f-4a0b-8c1d-2e3f4a5b6c55",
                    "source": "/warehouse/exception-management",
                    "type": "com.warehouse.wes.exception-management.exceptionpolicy.ExceptionPolicyDeclared",
                    "subject": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                    "time": "2026-10-21T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:exception-management:analytics:ExceptionPolicyDeclared:v1",
                    "data": {
                      "source_type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                      "version": 1,
                      "severity": "HIGH",
                      "queue": "cps-front",
                      "sla_minutes": 30,
                      "auto_resolve": {
                        "on_type": "com.warehouse.wes.order-management.order.OrderRepromised",
                        "within_minutes": 60
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's integration topic. This service consumes\n`TaskCPTMissed`, `PackageDiverted` and `WeightDiscrepancyDetected` under\na stable consumer group read from env `FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP`.\nEvery other type on the topic is ignored. `PackageDiverted` and\n`WeightDiscrepancyDetected` arrive here only after the producer's\npromotion PR (they are analytics-only today); the contract below is\npinned consumer-first.\n",
      "publish": {
        "operationId": "consumeFulfillmentEvents",
        "summary": "Consume fulfillment-execution exception facts.",
        "description": "`TaskCPTMissed` is re-fired on every sweep tick by design: a repeat\ndoes not open a second case, it touches the open one (occurrence + 1,\n`lastSeenAt`). `order_ref` is WES's per-line work unit id\n`{order_id}-line-{line_no}` (order-management ADR 0018); an\n`OrderRepromised` for that order line closes the case through the\npolicy's auto-resolve rule. The CloudEvents `id` claim and the effect\ncommit in one transaction; the offset is committed afterwards (ADR 0003).\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "TaskCPTMissed",
              "title": "TaskCPTMissed (consumed, fulfillment-execution)",
              "summary": "A task is still open past its CPT deadline.",
              "description": "`type` = `com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed`,\nsource `/warehouse/fulfillment-execution`, dataschema\n`urn:warehouse:fulfillment-execution:events:TaskCPTMissed:v1`. Subject\nand Kafka key = the task id. Re-fired on every sweep pass while the\ntask stays open: every repeat after the first touches the open case\n(occurrence + 1, `lastSeenAt`), never opens a second one.\n`order_ref` is WES's work unit id `{order_id}-line-{line_no}`;\n`task_type` is omitted when unknown.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
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
                            "description": "The task still open past its CPT.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "The work unit id `{order_id}-line-{line_no}`.",
                            "x-parser-schema-id": "<anonymous-schema-67>"
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
                            "description": "Omitted when unknown.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "cpt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The missed CPT deadline.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-65>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-64>"
                  }
                ],
                "x-parser-schema-id": "TaskCPTMissedEvent"
              },
              "examples": [
                {
                  "name": "taskCPTMissed",
                  "summary": "A PICK task is past its 14:55 CPT.",
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
              "name": "PackageDiverted",
              "title": "PackageDiverted (consumed, fulfillment-execution)",
              "summary": "A package was diverted off the standard path.",
              "description": "PENDING PRODUCER PROMOTION P1: fulfillment-execution publishes this\ntype on its analytics topic only today; it arrives on\n`warehouse.fulfillment.events` (dataschema\n`urn:warehouse:fulfillment-execution:events:PackageDiverted:v1`) once\nthe producer's promotion PR merges. `type` =\n`com.warehouse.wes.fulfillment-execution.package.PackageDiverted`,\nsource `/warehouse/fulfillment-execution`. Subject and Kafka key = the\npackage id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-72>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-70>"
                  }
                ],
                "x-parser-schema-id": "PackageDivertedEvent"
              },
              "examples": [
                {
                  "name": "packageDiverted",
                  "summary": "Package p1 left the standard path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageDiverted",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:PackageDiverted:v1",
                    "data": {
                      "package_id": "p1"
                    }
                  }
                }
              ]
            },
            {
              "name": "WeightDiscrepancyDetected",
              "title": "WeightDiscrepancyDetected (consumed, fulfillment-execution)",
              "summary": "SLAM found the package weight out of tolerance.",
              "description": "PENDING PRODUCER PROMOTION P1: analytics-only today; arrives on\n`warehouse.fulfillment.events` (dataschema\n`urn:warehouse:fulfillment-execution:events:WeightDiscrepancyDetected:v1`)\nonce the producer's promotion PR merges. `type` =\n`com.warehouse.wes.fulfillment-execution.package.WeightDiscrepancyDetected`,\nsource `/warehouse/fulfillment-execution`. Subject and Kafka key = the\npackage id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
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
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "expected_g": {
                            "type": "number",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "actual_g": {
                            "type": "number",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-73>"
                  }
                ],
                "x-parser-schema-id": "WeightDiscrepancyDetectedEvent"
              },
              "examples": [
                {
                  "name": "weightDiscrepancy",
                  "summary": "The package weighed 1200 g against an expected 1000 g.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4d",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.WeightDiscrepancyDetected",
                    "subject": "p1",
                    "time": "2026-09-30T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:WeightDiscrepancyDetected:v1",
                    "data": {
                      "package_id": "p1",
                      "expected_g": 1000,
                      "actual_g": 1200
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
      "description": "wes-work-planning's integration topic. This service consumes ONLY\n`BacklogThresholdBreached` under a stable consumer group read from env\n`WORK_PLANNING_EXCEPTIONS_CONSUMER_GROUP`. Every other type is ignored.\n",
      "publish": {
        "operationId": "consumeWorkPlanningEvents",
        "summary": "Consume the backlog alarm of a process path.",
        "description": "The published `data` carries only `path_id` (the producer's contract);\nthe case is one per path while the alarm keeps re-firing on every\nobservation sweep. Repeats touch the open case, they never open a\nsecond one. The CloudEvents `id` claim and the effect commit in one\ntransaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "BacklogThresholdBreached",
          "title": "BacklogThresholdBreached (consumed, wes-work-planning)",
          "summary": "A path's backlog depth crossed its alarm threshold.",
          "description": "`type` = `com.warehouse.wes.work-planning.workpool.BacklogThresholdBreached`,\nsource `/warehouse/wes-work-planning`, dataschema\n`urn:warehouse:wes-work-planning:events:BacklogThresholdBreached:v1`.\nSubject and Kafka key = the path id. The published `data` carries ONLY\n`path_id` (the producer's contract); consumers wanting the depth and\nrate numbers read the producer's telemetry projection instead. The\nsignal re-fires on every observation sweep: repeats touch the open\ncase, never open a second one.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "description": "The process path whose backlog crossed its alarm threshold.",
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-79>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-78>"
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
        }
      }
    },
    "warehouse.network-fulfillment.events": {
      "description": "network-fulfillment's integration topic. This service consumes\n`AcknowledgementDeadlineAtRisk` and `OrphanedHoldCancelled` under a\nstable consumer group read from env `NETWORK_FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP`.\nEvery other type is ignored.\n",
      "publish": {
        "operationId": "consumeNetworkFulfillmentEvents",
        "summary": "Consume network-order acknowledgement risk and orphaned holds.",
        "description": "Both events re-fire on every sweep pass for as long as the condition\nholds: a repeat touches the open case (occurrence + 1, `lastSeenAt`),\nnever opens a second one. The CloudEvents `id` claim and the effect\ncommit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "AcknowledgementDeadlineAtRisk",
              "title": "AcknowledgementDeadlineAtRisk (consumed, network-fulfillment)",
              "summary": "A network order's acknowledgement window closed with no answer.",
              "description": "`type` = `com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk`,\nsource `/warehouse/network-fulfillment`, dataschema\n`urn:warehouse:network-fulfillment:events:AcknowledgementDeadlineAtRisk:v1`.\nSubject and Kafka key = the network order reference (`networkRef`). A\nreported fact that re-fires on every sweep pass while the order is\nstill NEW past `acknowledgeBy`: repeats touch the open case, never\nopen a second one.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "networkRef",
                          "siteId",
                          "acknowledgeBy",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          },
                          "siteId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          },
                          "acknowledgeBy": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-82>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-81>"
                  }
                ],
                "x-parser-schema-id": "AcknowledgementDeadlineAtRiskEvent"
              },
              "examples": [
                {
                  "name": "acknowledgementDeadlineAtRisk",
                  "summary": "Network order po-1's acknowledgement window closed unanswered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1a2b3c4d-5e6f-4788-9900-aabbccddeeff",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk",
                    "subject": "po-1",
                    "time": "2026-09-24T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:AcknowledgementDeadlineAtRisk:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "acknowledgeBy": "2026-09-24T08:00:00Z",
                      "at": "2026-09-24T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrphanedHoldCancelled",
              "title": "OrphanedHoldCancelled (consumed, network-fulfillment)",
              "summary": "A hold order-management made for demand nobody decided was cancelled.",
              "description": "`type` = `com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled`,\nsource `/warehouse/network-fulfillment`, dataschema\n`urn:warehouse:network-fulfillment:events:OrphanedHoldCancelled:v1`.\nSubject and Kafka key = the network order reference (`networkRef`).\n`answer` is what order-management said to the cancel (`CANCELLED` or\n`NOT_FOUND`); `localOrderId` is the held order-management order.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "networkRef",
                          "siteId",
                          "localOrderId",
                          "acknowledgeBy",
                          "answer",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          },
                          "siteId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "localOrderId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          },
                          "acknowledgeBy": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          },
                          "answer": {
                            "type": "string",
                            "enum": [
                              "CANCELLED",
                              "NOT_FOUND"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-87>"
                  }
                ],
                "x-parser-schema-id": "OrphanedHoldCancelledEvent"
              },
              "examples": [
                {
                  "name": "orphanedHoldCancelled",
                  "summary": "The hold behind network order po-1 was cancelled after its window closed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2b3c4d5e-6f70-4899-8011-bbccddeeff00",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:OrphanedHoldCancelled:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "acknowledgeBy": "2026-09-23T06:00:00Z",
                      "answer": "CANCELLED",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.order-management.events": {
      "description": "order-management's integration topic. This service consumes ONLY\n`OrderRepromised` under a stable consumer group read from env\n`ORDER_CORRELATION_CONSUMER_GROUP`, and never as a case source: it is\nthe correlated fact that auto-resolves an open `TaskCPTMissed` case for\nthe same work unit (ADR 0002 auto-resolve rule). Every other type is\nignored.\n",
      "publish": {
        "operationId": "consumeOrderCorrelationEvents",
        "summary": "Consume re-promises as the correlated fact of the auto-resolve rule.",
        "description": "`OrderRepromised` opens no case. The rule reverses the work-unit\nformula (`{order_id}-line-{line_no}`) of the open case's source\n`order_ref` and compares it with the repromised `order_id`; a match\nwithin the rule's window auto-resolves the case, a mismatch is a\nno-op (the case stays open — fails soft). The CloudEvents `id` claim\nand the effect commit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "OrderRepromised",
          "title": "OrderRepromised (consumed, order-management)",
          "summary": "A missed CPT pushed the order's promise to a later cutoff.",
          "description": "`type` = `com.warehouse.wes.order-management.order.OrderRepromised`,\nsource `/warehouse/order-management`, dataschema\n`urn:warehouse:order-management:events:OrderRepromised:v1`. Subject and\nKafka key = the order id. Never a case source: it is the correlated\nfact of the auto-resolve rule. The rule reverses the work-unit formula\nof the open case's source `order_ref` and compares it with\n`order_id`; no match is a no-op (the case stays open).\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "order_id",
                      "cpt_id_old",
                      "cpt_id_new",
                      "reason"
                    ],
                    "properties": {
                      "order_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      },
                      "cpt_id_old": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      },
                      "cpt_id_new": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-99>"
                      },
                      "reason": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-100>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-95>"
              }
            ],
            "x-parser-schema-id": "OrderRepromisedEvent"
          },
          "examples": [
            {
              "name": "orderRepromised",
              "summary": "The promise moved from the 12:00 to the 18:00 cutoff.",
              "payload": {
                "specversion": "1.0",
                "id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
                "source": "/warehouse/order-management",
                "type": "com.warehouse.wes.order-management.order.OrderRepromised",
                "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                "time": "2026-09-14T12:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:order-management:events:OrderRepromised:v1",
                "data": {
                  "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                  "cpt_id_old": "sp1-1200",
                  "cpt_id_new": "sp1-1800",
                  "reason": "TaskCPTMissed"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.returns-processing.events": {
      "description": "returns-processing's integration topic. This service consumes ONLY\n`UnexpectedReturnReceived` under a stable consumer group read from env\n`RETURNS_EXCEPTIONS_CONSUMER_GROUP` (the producer ships in wave 3; the\ncontract below is pinned consumer-first). Every other type is ignored.\n",
      "publish": {
        "operationId": "consumeReturnsEvents",
        "summary": "Consume unexpected returns as problem-solve facts.",
        "description": "A return line that arrived with no authorization opens one case per\nreceipt line. The CloudEvents `id` claim and the effect commit in one\ntransaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "UnexpectedReturnReceived",
          "title": "UnexpectedReturnReceived (consumed, returns-processing)",
          "summary": "A return line arrived with no authorization.",
          "description": "PENDING PRODUCER (wave 3): returns-processing ships this type on\n`warehouse.returns-processing.events`; the contract is pinned here\nconsumer-first from the fleet plan. `type` =\n`com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived`,\nsource `/warehouse/returns-processing`, dataschema\n`urn:warehouse:returns-processing:events:UnexpectedReturnReceived:v1`.\nSubject and Kafka key = the receipt id. One case per receipt line;\nrepeats touch the open case.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "receipt_id",
                      "line_no",
                      "sku",
                      "quantity",
                      "site_id",
                      "received_at"
                    ],
                    "properties": {
                      "receipt_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      },
                      "line_no": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-105>"
                      },
                      "quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-106>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-107>"
                      },
                      "received_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-108>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-102>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-101>"
              }
            ],
            "x-parser-schema-id": "UnexpectedReturnReceivedEvent"
          },
          "examples": [
            {
              "name": "unexpectedReturn",
              "summary": "Two units of SKU-9 arrived at site-1 with no RMA.",
              "payload": {
                "specversion": "1.0",
                "id": "8d7c6b5a-4f3e-4d2c-9b1a-0f9e8d7c6b5e",
                "source": "/warehouse/returns-processing",
                "type": "com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived",
                "subject": "rcpt-31c7",
                "time": "2026-10-21T10:12:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:returns-processing:events:UnexpectedReturnReceived:v1",
                "data": {
                  "receipt_id": "rcpt-31c7",
                  "line_no": 1,
                  "sku": "SKU-9",
                  "quantity": 2,
                  "site_id": "site-1",
                  "received_at": "2026-10-21T10:12:00Z"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.inbound-receiving.events": {
      "description": "inbound-receiving's integration topic. This service consumes ONLY\n`CartonDiscrepancyRaised` under a stable consumer group read from env\n`CARTON_DISCREPANCY_CONSUMER_GROUP` (ADR 0006). Every other type is\nignored.\n",
      "publish": {
        "operationId": "consumeInboundReceivingEvents",
        "summary": "Consume carton discrepancies as routed cases.",
        "description": "One case per (receipt_id, sscc or \"-\", kind). Missing, Duplicate,\nUnexpected, CaseQtyMismatch, MixedCaseDeclaredAsCasePack,\nMixedCartonContentMismatch, UnknownGtin and any unknown kind route to\nthe problem-solve policy; UnlabelledCarton and CartonOverLimit to the\nreceiving-lead policy (informational). The CloudEvents `id` claim and\nthe effect commit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "CartonDiscrepancyRaised",
          "title": "CartonDiscrepancyRaised (consumed, inbound-receiving)",
          "summary": "A carton did not match its ASN or failed a receiving check.",
          "description": "`type` =\n`com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised`,\nsource `/warehouse/inbound-receiving`, subject and Kafka key = the\nreceipt id. `kind` is an open string (UnexpectedCarton, MissingCarton,\nDuplicateSscc, UnknownGtin, CaseQtyMismatch, MixedCaseDeclaredAsCasePack,\nUnlabelledCarton, CartonOverLimit, MixedCartonContentMismatch, ...).\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "receipt_id",
                      "kind",
                      "at"
                    ],
                    "properties": {
                      "receipt_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      },
                      "sscc": {
                        "type": "string",
                        "description": "The carton's SSCC-18; absent when the discrepancy is not about one carton.",
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "kind": {
                        "type": "string",
                        "description": "Open string; unknown kinds route to problem-solve.",
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      },
                      "expected": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      },
                      "actual": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-115>"
                      },
                      "at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-116>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-110>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-109>"
              }
            ],
            "x-parser-schema-id": "CartonDiscrepancyRaisedEvent"
          },
          "examples": [
            {
              "name": "caseQtyMismatch",
              "summary": "A case declared 12 units but 10 were counted.",
              "payload": {
                "specversion": "1.0",
                "id": "5b2f0c1e-7a44-4b58-8f5d-2f6c1a9d3e10",
                "source": "/warehouse/inbound-receiving",
                "type": "com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised",
                "subject": "rcpt-77",
                "time": "2026-10-24T09:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:inbound-receiving:events:CartonDiscrepancyRaised:v1",
                "data": {
                  "receipt_id": "rcpt-77",
                  "sscc": "340123450000000013",
                  "kind": "CaseQtyMismatch",
                  "expected": "12",
                  "actual": "10",
                  "at": "2026-10-24T09:00:00Z"
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.inventory.events": {
      "description": "inventory-storage's integration topic. This service consumes\n`DiscrepancyDetected` and `ItemUnlocated` under a stable consumer group\nread from env `INVENTORY_EXCEPTIONS_CONSUMER_GROUP`. Both types arrive\nhere only after the producer's promotion PR (they are analytics-only\ntoday); the contracts below are pinned consumer-first. Every other type\nis ignored.\n",
      "publish": {
        "operationId": "consumeInventoryEvents",
        "summary": "Consume count discrepancies and unlocated stock.",
        "description": "A short count (`DiscrepancyDetected`) and the stock it could not find\n(`ItemUnlocated`) each open or touch their own case. The CloudEvents\n`id` claim and the effect commit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "DiscrepancyDetected",
              "title": "DiscrepancyDetected (consumed, inventory-storage)",
              "summary": "A cycle count found the bin did not match system records.",
              "description": "PENDING PRODUCER PROMOTION P1: analytics-only today; arrives on\n`warehouse.inventory.events` (dataschema\n`urn:warehouse:inventory-storage:events:DiscrepancyDetected:v1`) once\nthe producer's promotion PR merges. `type` =\n`com.warehouse.wms.inventory-storage.bin.DiscrepancyDetected`, source\n`/warehouse/inventory-storage`. Subject and Kafka key = the bin id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "bin_id",
                          "counted",
                          "system"
                        ],
                        "properties": {
                          "bin_id": {
                            "type": "string",
                            "description": "The bin whose count did not match system records.",
                            "x-parser-schema-id": "<anonymous-schema-119>"
                          },
                          "counted": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity physically counted in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-120>"
                          },
                          "system": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity the system believed was in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-121>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-118>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-117>"
                  }
                ],
                "x-parser-schema-id": "DiscrepancyDetectedEvent"
              },
              "examples": [
                {
                  "name": "binCountShort",
                  "summary": "Bin A-12-3 counted at 47 units against a system record of 50.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c2a90b76-8e34-4f51-9d07-4b6e1c8a37f9",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.bin.DiscrepancyDetected",
                    "subject": "A-12-3",
                    "time": "2026-08-21T23:00:01Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:DiscrepancyDetected:v1",
                    "data": {
                      "bin_id": "A-12-3",
                      "counted": 47,
                      "system": 50
                    }
                  }
                }
              ]
            },
            {
              "name": "ItemUnlocated",
              "title": "ItemUnlocated (consumed, inventory-storage)",
              "summary": "A physical item's bin is no longer known; the stock is lost.",
              "description": "PENDING PRODUCER PROMOTION P1: analytics-only today; arrives on\n`warehouse.inventory.events` (dataschema\n`urn:warehouse:inventory-storage:events:ItemUnlocated:v1`) once the\nproducer's promotion PR merges. `type` =\n`com.warehouse.wms.inventory-storage.stock.ItemUnlocated`, source\n`/warehouse/inventory-storage`. Subject = the stock unit id, Kafka key\n= the SKU.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "stock_unit_id",
                          "sku",
                          "bin_id",
                          "quantity"
                        ],
                        "properties": {
                          "stock_unit_id": {
                            "type": "string",
                            "description": "The StockUnit flagged Unlocated.",
                            "x-parser-schema-id": "<anonymous-schema-124>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-125>"
                          },
                          "bin_id": {
                            "type": "string",
                            "description": "The bin the stock was believed to be in.",
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity that could not be accounted for.",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  }
                ],
                "x-parser-schema-id": "ItemUnlocatedEvent"
              },
              "examples": [
                {
                  "name": "shortCountUnlocatedStock",
                  "summary": "Three units of SKU-1001 could not be found in bin A-12-3.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e0d5a83-4f19-42b7-a3c6-8b1e9d2f0c45",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.stock.ItemUnlocated",
                    "subject": "su-7781",
                    "time": "2026-08-21T23:00:02Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:ItemUnlocated:v1",
                    "data": {
                      "stock_unit_id": "su-7781",
                      "sku": "SKU-1001",
                      "bin_id": "A-12-3",
                      "quantity": 3
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
      "ExceptionOpened": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0]",
      "ExceptionTriaged": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[1]",
      "ExceptionAssigned": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[2]",
      "ExceptionEscalated": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[3]",
      "ExceptionResolved": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[4]",
      "ExceptionAutoResolved": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[5]",
      "ExceptionPolicyDeclared": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[6]",
      "TaskCPTMissed": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[0]",
      "PackageDiverted": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[1]",
      "WeightDiscrepancyDetected": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[2]",
      "BacklogThresholdBreached": "$ref:$.channels.warehouse.work-planning.events.publish.message",
      "AcknowledgementDeadlineAtRisk": "$ref:$.channels.warehouse.network-fulfillment.events.publish.message.oneOf[0]",
      "OrphanedHoldCancelled": "$ref:$.channels.warehouse.network-fulfillment.events.publish.message.oneOf[1]",
      "OrderRepromised": "$ref:$.channels.warehouse.order-management.events.publish.message",
      "UnexpectedReturnReceived": "$ref:$.channels.warehouse.returns-processing.events.publish.message",
      "CartonDiscrepancyRaised": "$ref:$.channels.warehouse.inbound-receiving.events.publish.message",
      "DiscrepancyDetected": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[0]",
      "ItemUnlocated": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[1]",
      "ExceptionOpenedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[0]",
      "ExceptionTriagedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[1]",
      "ExceptionAssignedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[2]",
      "ExceptionEscalatedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[3]",
      "ExceptionResolvedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[4]",
      "ExceptionAutoResolvedAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[5]",
      "ExceptionPolicyDeclaredAnalytics": "$ref:$.channels.warehouse.exception-management.analytics.subscribe.message.oneOf[6]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "ExceptionOpenedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[0].payload",
      "ExceptionTriagedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[1].payload",
      "ExceptionAssignedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[2].payload",
      "ExceptionEscalatedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[3].payload",
      "ExceptionResolvedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[4].payload",
      "ExceptionAutoResolvedEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[5].payload",
      "ExceptionPolicyDeclaredEvent": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[6].payload",
      "AutoResolveRule": "$ref:$.channels.warehouse.exception-management.events.subscribe.message.oneOf[6].payload.allOf[1].properties.data.properties.auto_resolve.allOf[0]",
      "TaskCPTMissedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[0].payload",
      "PackageDivertedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[1].payload",
      "WeightDiscrepancyDetectedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[2].payload",
      "BacklogThresholdBreachedEvent": "$ref:$.channels.warehouse.work-planning.events.publish.message.payload",
      "AcknowledgementDeadlineAtRiskEvent": "$ref:$.channels.warehouse.network-fulfillment.events.publish.message.oneOf[0].payload",
      "OrphanedHoldCancelledEvent": "$ref:$.channels.warehouse.network-fulfillment.events.publish.message.oneOf[1].payload",
      "OrderRepromisedEvent": "$ref:$.channels.warehouse.order-management.events.publish.message.payload",
      "UnexpectedReturnReceivedEvent": "$ref:$.channels.warehouse.returns-processing.events.publish.message.payload",
      "CartonDiscrepancyRaisedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.publish.message.payload",
      "DiscrepancyDetectedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[0].payload",
      "ItemUnlocatedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.oneOf[1].payload"
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
  