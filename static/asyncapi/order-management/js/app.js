
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Order Management — Domain & Analytics Events",
    "version": "1.0.0",
    "description": "Asynchronous event contract for the **Order Management** bounded context,\nthe generic/supporting context that owns the Order and OrderLine\naggregates: order intake, per-line stock allocation (via\ninventory-storage's reservation API), promise-date calculation, and\nchoreographed release of allocated work (announced to\nwes-work-planning as facts on Kafka — see ADR 0005).\n\n## Message format\n\nEvery message on these channels is a JSON document using the\nwarehouse-systems fleet envelope — NOT CloudEvents (unlike\nwes-work-planning's stream). Two envelope variants exist:\n\n* the **integration envelope** on `warehouse.order-management.events`:\n  `{event_id, event_type, occurred_at, source, data}` with\n  `source` always `\"order-management\"`\n* the **analytics envelope** on `warehouse.order-management.analytics`,\n  which adds `schema_version: 1`\n\nMessages are keyed by the `OrderId` on the analytics topic; the\nintegration topic is unkeyed. Delivery is at-least-once: consumers must\nbe idempotent, de-duplicating on `event_id` (the projector does exactly\nthat via its `analytics_processed_events` table).\n\n## Integration contract (frozen for OrderAllocated/OrderPartiallyAllocated;\nadditive for OrderRepromised)\n\n`OrderAllocated`, `OrderPartiallyAllocated`, and — since ADR 0014 §5 /\nADR 0018 — `OrderRepromised` are published to\n`warehouse.order-management.events` — mirroring\ninventory-storage's precedent of forwarding a minimal subset of domain\nevents cross-context. The `data.lines[]` entry shape on the first two\nis shared verbatim with wes-work-planning's Kafka consumer and MUST\nNOT change without coordinating both sides. `fulfillment_class` is\nadditive (ADR 0008). `OrderRepromised` is the fleet's \"your delivery\nis delayed\" trigger, raised by the new `RepromiseOrder` consumer\n(ADR 0018) reacting to fulfillment-execution's `TaskCPTMissed`/\n`PackageManifested` on `warehouse.fulfillment.events`.\n",
    "contact": {
      "name": "Order Management Team",
      "url": "https://warehouse-systems.internal/teams/order-management",
      "email": "order-management@warehouse-systems.internal"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0"
    }
  },
  "tags": [
    {
      "name": "order-management",
      "description": "The Order Management bounded context — order intake, allocation via inventory-storage, promise-date calculation, and choreographed release to wes-work-planning."
    },
    {
      "name": "analytics",
      "description": "The analytics data product's event stream (ADR 0006) — every domain event fanned out to the projector-driven analytical read side."
    },
    {
      "name": "order",
      "description": "Events raised by the Order aggregate."
    },
    {
      "name": "order-line",
      "description": "Events raised about a single OrderLine."
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Production Kafka cluster shared by every warehouse-systems bounded context. Locally, a broker is available at localhost:9092 via this repo's docker-compose.kafka.yml."
    }
  },
  "defaultContentType": "application/json",
  "channels": {
    "warehouse.order-management.events": {
      "description": "The outbound integration topic owned by the Order Management bounded context (`kafka.Topic` in the code). `OrderAllocated`/ `OrderPartiallyAllocated` and — since ADR 0018 — `OrderRepromised` are forwarded here; every other domain event is a local concern. wes-work-planning's Kafka consumer derives each line's work unit id from the frozen formula `{orderID}-line-{lineNo}`.",
      "subscribe": {
        "operationId": "consumeOrderManagementEvents",
        "summary": "Consume order allocation-outcome and re-promise integration events.",
        "description": "Subscribe to this channel to learn that an order's allocation-then-release pass concluded, or that its promise moved. `OrderAllocated` means every line was allocated (and every eligible line released in the same pass); `OrderPartiallyAllocated` means some lines allocated and some backordered on a partial-shipment order. `OrderRepromised` (ADR 0018) means the promise for a shipment group moved, discovered by reacting to a fulfillment-execution fact (a missed CPT or a SLAM pass) — the fleet's \"your delivery is delayed\" trigger. `data.lines[]` on the first two carries exactly the lines released in this pass. Consumers must be idempotent and should ignore `event_type` values they do not recognise.",
        "tags": [
          {
            "name": "order-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "OrderAllocated",
              "title": "Order Allocated (integration)",
              "summary": "Every line allocated — and eligible lines released in the same pass.",
              "description": "The whole order is allocated and, per the choreographed-release redesign (ADR 0005), every eligible line was released as part of this same fact. `data.lines[]` carries the released lines; each line's work unit id is derived, never transmitted, as `{order_id}-line-{line_no}`.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "description": "The fleet envelope used on warehouse.order-management.events.",
                    "additionalProperties": false,
                    "required": [
                      "event_id",
                      "event_type",
                      "occurred_at",
                      "source",
                      "data"
                    ],
                    "properties": {
                      "event_id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "De-duplication key; delivery is at-least-once.",
                        "x-parser-schema-id": "<anonymous-schema-1>"
                      },
                      "event_type": {
                        "type": "string",
                        "enum": [
                          "OrderAllocated",
                          "OrderPartiallyAllocated",
                          "OrderRepromised"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "source": {
                        "type": "string",
                        "enum": [
                          "order-management"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Frozen wire shape shared verbatim with wes-work-planning's Kafka consumer (see CLAUDE.md's Kafka integration section). promise_cpt_id/promise_basis are ADR 0014's additive fields (the CPT identity a Capability-basis promise targets, and which policy produced the promise) -- optional, since a LeadTime-basis promise has no CPT identity and older consumers may ignore both.",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "promise_date",
                          "lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "pattern": "^ord-[0-9a-f-]{36}$",
                            "description": "The OrderId this context owns and mints.",
                            "x-parser-schema-id": "<anonymous-schema-5>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The promise's cutoff instant. Computed by order.PromisePolicy (ADR 0014): a real CPT window's cutoff when promise_basis is \"Capability\", or the per-path lead-time policy's computed instant when promise_basis is \"LeadTime\" (or absent, for events predating ADR 0014).",
                            "x-parser-schema-id": "<anonymous-schema-6>"
                          },
                          "promise_cpt_id": {
                            "type": "string",
                            "description": "The CPT identity (e.g. \"sp1-1800\") this promise targets. Present only when promise_basis is \"Capability\" -- a LeadTime-basis promise has no departure identity.",
                            "x-parser-schema-id": "<anonymous-schema-7>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime"
                            ],
                            "description": "Which policy produced promise_date (ADR 0014). Absent on events published before this ADR.",
                            "x-parser-schema-id": "<anonymous-schema-8>"
                          },
                          "lines": {
                            "type": "array",
                            "description": "Exactly the lines released in this pass (may be empty).",
                            "items": {
                              "type": "object",
                              "additionalProperties": false,
                              "required": [
                                "line_no",
                                "sku",
                                "path_id",
                                "gift_wrap",
                                "fulfillment_class"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-10>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-11>"
                                },
                                "path_id": {
                                  "type": "string",
                                  "description": "The process path the line was released onto (default \"pick\").",
                                  "x-parser-schema-id": "<anonymous-schema-12>"
                                },
                                "gift_wrap": {
                                  "type": "boolean",
                                  "x-parser-schema-id": "<anonymous-schema-13>"
                                },
                                "fulfillment_class": {
                                  "type": "string",
                                  "enum": [
                                    "SINGLE",
                                    "SAME_SKU_MULTI",
                                    "MULTI_LINE_MULTI"
                                  ],
                                  "description": "Classifies the whole order (ADR 0008); additive field.",
                                  "x-parser-schema-id": "<anonymous-schema-14>"
                                },
                                "promise_cpt_id": {
                                  "type": "string",
                                  "description": "ADR 0017's additive per-line promise field: the CPT identity (e.g. \"sp1-1200\") the PromiseGroup this line belongs to targets. Present only when that group's basis is \"Capability\" and the group has a CPT identity. Absent when the order's promise has no per-group breakdown to attribute this line to (a promise set via the legacy, pre-ADR-0017 single-Promise path). Older consumers can safely ignore it.",
                                  "x-parser-schema-id": "<anonymous-schema-15>"
                                },
                                "promise_basis": {
                                  "type": "string",
                                  "enum": [
                                    "Capability",
                                    "LeadTime"
                                  ],
                                  "description": "ADR 0017's additive per-line promise field: which policy produced the PromiseGroup this line belongs to. Absent under the same condition as promise_cpt_id.",
                                  "x-parser-schema-id": "<anonymous-schema-16>"
                                },
                                "promise_cutoff_at": {
                                  "type": "string",
                                  "format": "date-time",
                                  "description": "ADR 0017's additive per-line promise field: the cutoff instant of the PromiseGroup this line belongs to -- may differ from the order-level promise_date on a partial-shipment order whose lines split across multiple groups (promise_date is always the LATEST group's cutoff; an individual line's own group may cut off earlier). Absent under the same condition as promise_cpt_id.",
                                  "x-parser-schema-id": "<anonymous-schema-17>"
                                }
                              },
                              "x-parser-schema-id": "ReleasedLine"
                            },
                            "x-parser-schema-id": "<anonymous-schema-9>"
                          }
                        },
                        "x-parser-schema-id": "AllocationData"
                      }
                    },
                    "x-parser-schema-id": "IntegrationEnvelope"
                  }
                ],
                "x-parser-schema-id": "AllocationEvent"
              },
              "examples": [
                {
                  "name": "orderAllocated",
                  "summary": "A two-line ship-complete order allocated and released.",
                  "payload": {
                    "event_id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "event_type": "OrderAllocated",
                    "occurred_at": "2026-09-07T10:01:00Z",
                    "source": "order-management",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "promise_date": "2026-09-09T10:01:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-BOOK-0001",
                          "path_id": "pick",
                          "gift_wrap": false,
                          "fulfillment_class": "SAME_SKU_MULTI"
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-BOOK-0002",
                          "path_id": "pick",
                          "gift_wrap": true,
                          "fulfillment_class": "SAME_SKU_MULTI"
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderPartiallyAllocated",
              "title": "Order Partially Allocated (integration)",
              "summary": "Some lines allocated, some backordered, on a partial-shipment order.",
              "description": "An order with AllowPartialShipment=true concluded its pass with some lines allocated (and released in this same pass — `data.lines[]` carries exactly those) and some lines Backordered. A ship-complete order NEVER emits this event: under BR3 its whole status stays Backordered until RetryAllocation succeeds.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload",
              "examples": [
                {
                  "name": "orderPartiallyAllocated",
                  "summary": "One line released, one line backordered.",
                  "payload": {
                    "event_id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                    "event_type": "OrderPartiallyAllocated",
                    "occurred_at": "2026-09-07T10:02:00Z",
                    "source": "order-management",
                    "data": {
                      "order_id": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                      "promise_date": "2026-09-09T10:02:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-TOY-0042",
                          "path_id": "pick",
                          "gift_wrap": false,
                          "fulfillment_class": "MULTI_LINE_MULTI"
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderRepromised",
              "title": "Order Repromised (integration)",
              "summary": "The promise for a shipment group moved — the fleet's \"your delivery is delayed\" trigger (ADR 0014 §5 / ADR 0018).",
              "description": "Raised by the RepromiseOrder use case when reacting to fulfillment-execution's TaskCPTMissed (a task still open past its CPT) or PackageManifested (a SLAM pass) reveals that the affected PromiseGroup's fresh recompute differs from its current promise. `cpt_id_old`/`cpt_id_new` are both absent (omitempty) for a LeadTime-basis promise on that side — a LeadTime-basis promise has no CPT departure identity, only a computed cutoff instant. This event does not itself contact a customer: it is the trigger, not the notification.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "event_id",
                      "event_type",
                      "occurred_at",
                      "source",
                      "data"
                    ],
                    "properties": {
                      "event_id": {
                        "type": "string",
                        "format": "uuid",
                        "x-parser-schema-id": "<anonymous-schema-19>"
                      },
                      "event_type": {
                        "type": "string",
                        "enum": [
                          "OrderRepromised"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-20>"
                      },
                      "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-21>"
                      },
                      "source": {
                        "type": "string",
                        "enum": [
                          "order-management"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The `data` payload shape for OrderRepromised (ADR 0014 §5 / ADR 0018). cpt_id_old/cpt_id_new are both omitempty for a LeadTime-basis promise on that side.",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "reason"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "pattern": "^ord-[0-9a-f-]{36}$",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "cpt_id_old": {
                            "type": "string",
                            "description": "The CPT identity the affected group targeted BEFORE the recompute. Absent for a LeadTime-basis previous promise.",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "cpt_id_new": {
                            "type": "string",
                            "description": "The CPT identity the affected group targets AFTER the recompute. Absent for a LeadTime-basis new promise.",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "TaskCPTMissed",
                              "PackageManifested"
                            ],
                            "description": "The fulfillment-execution event_type that triggered this recompute, verbatim.",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          }
                        },
                        "x-parser-schema-id": "RepromisedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-18>"
                  }
                ],
                "x-parser-schema-id": "RepromisedEvent"
              },
              "examples": [
                {
                  "name": "orderRepromised",
                  "summary": "A missed CPT pushed the promise to a later cutoff.",
                  "payload": {
                    "event_id": "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
                    "event_type": "OrderRepromised",
                    "occurred_at": "2026-09-14T12:00:00Z",
                    "source": "order-management",
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
          ]
        }
      }
    },
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's shared/fan-out integration topic — the SAME one labor-performance already consumes for `TaskCompleted`. This context consumes it ONLY for `TaskCPTMissed`/`PackageManifested` (ADR 0018, reacting to fulfillment-execution's own ADR 0025); every other event type on this topic is silently skipped. order-management does not import fulfillment-execution's Go code — this channel's messages below are this context's own independently-declared copy of that service's real, shipped wire shape.",
      "subscribe": {
        "operationId": "consumeFulfillmentEvents",
        "summary": "React to a missed CPT or a SLAM pass to re-promise the affected order.",
        "description": "`order_ref` on both message types is shaped like this context's own `WorkUnitID` formula (`{orderId}-line-{lineNo}`) — NOT a bare OrderId — because fulfillment-execution populates it from wes-work-planning's `WorkUnitId`, itself derived from this context's formula at release time. The `RepromiseOrder` consumer parses it back apart via `usecases.ParseWorkUnitID`.",
        "tags": [
          {
            "name": "order-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "TaskCPTMissed",
              "title": "Task CPT Missed (inbound, fulfillment-execution)",
              "summary": "A fulfillment-execution task is still open past its CPT.",
              "description": "Consumed from warehouse.fulfillment.events (ADR 0018). Re-fires on every sweep pass fulfillment-execution runs, for as long as the task stays overdue (that service's own ADR 0025 §4) — this context's own event_id-keyed idempotency gate is what makes that safe to consume. order_ref is a WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), not a bare OrderId.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "event_id",
                      "event_type",
                      "occurred_at",
                      "source",
                      "data"
                    ],
                    "properties": {
                      "event_id": {
                        "type": "string",
                        "format": "uuid",
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      },
                      "event_type": {
                        "type": "string",
                        "enum": [
                          "TaskCPTMissed"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      },
                      "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      },
                      "source": {
                        "type": "string",
                        "enum": [
                          "fulfillment-execution"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-31>"
                      },
                      "data": {
                        "type": "object",
                        "description": "fulfillment-execution's real, shipped TaskCPTMissed payload (its own ADR 0025 §7) — decoded independently here, never imported.",
                        "additionalProperties": false,
                        "required": [
                          "task_id",
                          "order_ref",
                          "cpt"
                        ],
                        "properties": {
                          "task_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "A WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), NOT a bare OrderId.",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "cpt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          }
                        },
                        "x-parser-schema-id": "TaskCPTMissedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-27>"
                  }
                ],
                "x-parser-schema-id": "TaskCPTMissedEvent"
              },
              "examples": [
                {
                  "name": "taskCPTMissed",
                  "summary": "A PICK task for order line 2 is still open past its CPT.",
                  "payload": {
                    "event_id": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
                    "event_type": "TaskCPTMissed",
                    "occurred_at": "2026-09-14T11:59:00Z",
                    "source": "fulfillment-execution",
                    "data": {
                      "task_id": "task-42",
                      "order_ref": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-2",
                      "task_type": "PICK",
                      "cpt": "2026-09-14T11:55:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "PackageManifested",
              "title": "Package Manifested (inbound, fulfillment-execution)",
              "summary": "A package passed SLAM (weigh-check succeeded).",
              "description": "Consumed from warehouse.fulfillment.events (ADR 0018). Raised alongside LabelApplied on fulfillment-execution's own outbox (its ADR 0025 §5). order_ref is a WorkUnitId-shaped reference, not a bare OrderId.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                      "event_id",
                      "event_type",
                      "occurred_at",
                      "source",
                      "data"
                    ],
                    "properties": {
                      "event_id": {
                        "type": "string",
                        "format": "uuid",
                        "x-parser-schema-id": "<anonymous-schema-37>"
                      },
                      "event_type": {
                        "type": "string",
                        "enum": [
                          "PackageManifested"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "source": {
                        "type": "string",
                        "enum": [
                          "fulfillment-execution"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "data": {
                        "type": "object",
                        "description": "fulfillment-execution's real, shipped PackageManifested payload (its own ADR 0025 §7) — decoded independently here, never imported.",
                        "additionalProperties": false,
                        "required": [
                          "package_id",
                          "order_ref"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "A WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), NOT a bare OrderId.",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          }
                        },
                        "x-parser-schema-id": "PackageManifestedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-36>"
                  }
                ],
                "x-parser-schema-id": "PackageManifestedEvent"
              },
              "examples": [
                {
                  "name": "packageManifested",
                  "summary": "A package for order line 1 passed SLAM.",
                  "payload": {
                    "event_id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
                    "event_type": "PackageManifested",
                    "occurred_at": "2026-09-14T12:01:00Z",
                    "source": "fulfillment-execution",
                    "data": {
                      "package_id": "pkg-99",
                      "order_ref": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-1"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.order-management.analytics": {
      "description": "The analytics fan-out topic (`kafka.AnalyticsTopic` in the code), separate from the integration topic so the OLTP integration contract and the analytical read-model stream evolve independently (ADR 0006). order-management publishes every analytics-relevant domain event here; cmd/order-projector is the sole consumer and the only writer of the analytical store.",
      "publish": {
        "operationId": "publishOrderAnalytics",
        "summary": "Fan out order domain events for the analytics data product.",
        "description": "order-management publishes each domain event (enriched with its process path via an OrderRepo lookup) as an analytics envelope with schema_version 1. Unrecognised event types are skipped by the publisher, so this channel only ever carries the ten types listed under subscribe below. Since ADR 0019, OrderAllocated/ OrderPartiallyAllocated additionally carry promise_basis/ promise_cutoff_at/split_shipment (ADR 0014 §6's promise KPIs), and OrderRepromised (ADR 0018) is published here too, deliberately WITHOUT a path_id — see OrderRepromisedAnalytics below.",
        "tags": [
          {
            "name": "order-management"
          },
          {
            "name": "analytics"
          }
        ]
      },
      "subscribe": {
        "operationId": "projectOrderAnalytics",
        "summary": "Project order events into the analytical store.",
        "description": "cmd/order-projector consumes this topic from FirstOffset and is the ONLY writer of the analytical Postgres. It is idempotent on event_id; a redelivery is always a no-op. The report keyed per path x hour (Order Funnel & Allocation Health) reads what this projection writes; since ADR 0019 it also derives promise basis distribution, re-promise rate, split-shipment rate, and promise-to-cutoff gap from this same stream.",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "OrderReceived",
              "title": "Order Received (analytics)",
              "summary": "An order was accepted into the building with its lines.",
              "description": "The funnel's top stage. Published unconditionally at intake, before allocation is ever attempted.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "description": "The analytics envelope used on warehouse.order-management.analytics — the fleet envelope plus schema_version.",
                    "additionalProperties": false,
                    "required": [
                      "event_id",
                      "event_type",
                      "occurred_at",
                      "source",
                      "schema_version",
                      "data"
                    ],
                    "properties": {
                      "event_id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "The projector's idempotency key.",
                        "x-parser-schema-id": "<anonymous-schema-43>"
                      },
                      "event_type": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "occurred_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      },
                      "source": {
                        "type": "string",
                        "enum": [
                          "order-management"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      },
                      "schema_version": {
                        "type": "integer",
                        "enum": [
                          1
                        ],
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The event_type-specific snake_case payload (see messages).",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      }
                    },
                    "x-parser-schema-id": "AnalyticsEnvelope"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "path_id",
                          "line_count"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "line_count": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-49>"
                  }
                ],
                "x-parser-schema-id": "OrderReceivedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderReceived",
                  "summary": "A two-line order was received on the pick path.",
                  "payload": {
                    "event_id": "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
                    "event_type": "OrderReceived",
                    "occurred_at": "2026-09-07T10:00:00Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick",
                      "line_count": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderLineAllocated",
              "title": "Order Line Allocated (analytics)",
              "summary": "inventory-storage accepted a reservation for a line.",
              "description": "Reservation state stays owned by inventory-storage; this fact carries only the line's identifying details for the funnel.",
              "tags": [
                {
                  "name": "order-line"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "line_no",
                          "path_id",
                          "sku"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-54>"
                  }
                ],
                "x-parser-schema-id": "OrderLineAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderLineAllocated",
                  "summary": "Line 1 of an order was allocated.",
                  "payload": {
                    "event_id": "d2e3f4a5-6b7c-4d8e-9f0a-1b2c3d4e5f6a",
                    "event_type": "OrderLineAllocated",
                    "occurred_at": "2026-09-07T10:00:30Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 1,
                      "path_id": "pick",
                      "sku": "SKU-BOOK-0001"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderLineBackordered",
              "title": "Order Line Backordered (analytics)",
              "summary": "inventory-storage reported insufficient usable stock (HTTP 409).",
              "description": "Funnel leakage. A BUSINESS FACT only — never produced from a transport or 5xx failure (those fail the call outright instead).",
              "tags": [
                {
                  "name": "order-line"
                }
              ],
              "payload": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[1].payload",
              "examples": [
                {
                  "name": "orderLineBackordered",
                  "summary": "Line 2 was backordered.",
                  "payload": {
                    "event_id": "e3f4a5b6-7c8d-4e9f-0a1b-2c3d4e5f6a7b",
                    "event_type": "OrderLineBackordered",
                    "occurred_at": "2026-09-07T10:00:31Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                      "line_no": 2,
                      "path_id": "pick",
                      "sku": "SKU-TOY-9999"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderAllocated",
              "title": "Order Allocated (analytics)",
              "summary": "Every line on the order is allocated (and released).",
              "description": "The funnel's allocated stage; the path dimension comes from the first released line (or an OrderRepo lookup when none were released).",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "path_id"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-62>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime"
                            ],
                            "description": "ADR 0014 §6 / ADR 0019's additive promise-basis- distribution field, mirrored from the OrderAllocated domain event's own promise_basis. Absent on events published before this ADR, or when the underlying promise had no basis recorded.",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "promise_cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "ADR 0014 §6 / ADR 0019's additive promise-to-cutoff-gap source field: the promise's cutoff instant. Present ONLY when promise_basis is \"Capability\" — a LeadTime-basis promise's \"cutoff\" is just now-plus-a-configured-duration, not a real departure, and is deliberately excluded from the gap KPI.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "split_shipment": {
                            "type": "boolean",
                            "description": "ADR 0014 §6 / ADR 0019's additive split-shipment-rate source field: true when the order had more than one order.PromiseGroup at allocation time (ADR 0014 §3 / ADR 0017), derived via an OrderRepo lookup at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-60>"
                  }
                ],
                "x-parser-schema-id": "OrderAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderAllocatedAnalytics",
                  "summary": "An order concluded its pass fully allocated on pick.",
                  "payload": {
                    "event_id": "f4a5b6c7-8d9e-4f0a-1b2c-3d4e5f6a7b8c",
                    "event_type": "OrderAllocated",
                    "occurred_at": "2026-09-07T10:01:00Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderPartiallyAllocated",
              "title": "Order Partially Allocated (analytics)",
              "summary": "Some lines allocated, some backordered.",
              "description": "Carries the allocated/backordered split for allocation-health reporting on partial-shipment orders.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "path_id",
                          "allocated_lines",
                          "backordered_lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          },
                          "allocated_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-71>"
                          },
                          "backordered_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-72>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime"
                            ],
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          },
                          "promise_cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "split_shipment": {
                            "type": "boolean",
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-68>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-67>"
                  }
                ],
                "x-parser-schema-id": "OrderPartiallyAllocatedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderPartiallyAllocatedAnalytics",
                  "summary": "One line allocated, one backordered.",
                  "payload": {
                    "event_id": "a5b6c7d8-9e0f-4a1b-2c3d-4e5f6a7b8c9d",
                    "event_type": "OrderPartiallyAllocated",
                    "occurred_at": "2026-09-07T10:02:00Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                      "path_id": "pick",
                      "allocated_lines": 1,
                      "backordered_lines": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderAllocationPartiallyFailed",
              "title": "Order Allocation Partialially Failed (analytics)",
              "summary": "A hard failure hit mid-allocation; some lines genuinely allocated.",
              "description": "Fail-closed visibility (ADR 0003): the already-succeeded reservations are kept, remaining lines stay Pending, and this fact makes the outcome observable rather than silent.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "path_id",
                          "allocated_lines",
                          "remaining_lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          },
                          "allocated_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          },
                          "remaining_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-77>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-76>"
                  }
                ],
                "x-parser-schema-id": "OrderAllocationPartiallyFailedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderAllocationPartiallyFailed",
                  "summary": "One line allocated before inventory-storage became unreachable.",
                  "payload": {
                    "event_id": "b6c7d8e9-0f1a-4b2c-3d4e-5f6a7b8c9d0e",
                    "event_type": "OrderAllocationPartiallyFailed",
                    "occurred_at": "2026-09-07T10:03:00Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
                      "path_id": "pick",
                      "allocated_lines": 1,
                      "remaining_lines": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderLineReleased",
              "title": "Order Line Released (analytics)",
              "summary": "A line's work was announced as released to wes-work-planning.",
              "description": "Since ADR 0005 release is choreographed — there is no synchronous call — so this fact is announced per line, carrying the path the line was released onto and the deterministic work unit id.",
              "tags": [
                {
                  "name": "order-line"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "line_no",
                          "path_id",
                          "work_unit_id"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "{order_id}-line-{line_no} — deterministic, derived by BOTH sides.",
                            "x-parser-schema-id": "<anonymous-schema-87>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-82>"
                  }
                ],
                "x-parser-schema-id": "OrderLineReleasedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderLineReleased",
                  "summary": "Line 1 released onto the pick path.",
                  "payload": {
                    "event_id": "c7d8e9f0-1a2b-4c3d-4e5f-6a7b8c9d0e1f",
                    "event_type": "OrderLineReleased",
                    "occurred_at": "2026-09-07T10:01:30Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 1,
                      "path_id": "pick",
                      "work_unit_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-1"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderReleased",
              "title": "Order Released (analytics)",
              "summary": "Every line on the order has been released as work.",
              "description": "The funnel's bottom stage.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[3].payload",
              "examples": [
                {
                  "name": "orderReleased",
                  "summary": "The order fully released on the pick path.",
                  "payload": {
                    "event_id": "d8e9f0a1-2b3c-4d4e-5f6a-7b8c9d0e1f2a",
                    "event_type": "OrderReleased",
                    "occurred_at": "2026-09-07T10:01:31Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick"
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderCancelled",
              "title": "Order Cancelled (analytics)",
              "summary": "The order was cancelled before any line was released.",
              "description": "Funnel leakage at the cancellation boundary (BR6): legal only while no line has reached Released. Revoked reservations were returned to inventory-storage.",
              "tags": [
                {
                  "name": "order"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "path_id",
                          "revoked_reservations"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          },
                          "revoked_reservations": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-88>"
                  }
                ],
                "x-parser-schema-id": "OrderCancelledAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderCancelled",
                  "summary": "A pre-release order was cancelled, revoking one reservation.",
                  "payload": {
                    "event_id": "e9f0a1b2-3c4d-4e5f-6a7b-8c9d0e1f2a3b",
                    "event_type": "OrderCancelled",
                    "occurred_at": "2026-09-07T10:04:00Z",
                    "source": "order-management",
                    "schema_version": 1,
                    "data": {
                      "order_id": "ord-4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a",
                      "path_id": "pick",
                      "revoked_reservations": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "OrderRepromised",
              "title": "Order Repromised (analytics)",
              "summary": "The promise for a shipment group moved — the re-promise-rate KPI's source fact (ADR 0014 §6 / ADR 0019).",
              "description": "Published on the analytics topic since ADR 0019, closing a gap left when ADR 0018 shipped the RepromiseOrder consumer: this event was raised on the integration topic (warehouse.order-management.events) but never reached the analytics publisher's marshalData switch. Deliberately carries NO path_id, unlike every other analytics message on this channel — OrderRepromised itself has no process-path dimension in its domain event, and this data product tracks the re-promise-rate KPI fleet-wide rather than adding an OrderRepo lookup for a dimension nothing asked for (see ADR 0019's Decision §2 for the full reasoning). cpt_id_old/cpt_id_new are both omitempty for a LeadTime-basis promise on that side, same as the integration-topic message.",
              "tags": [
                {
                  "name": "order"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "description": "Deliberately has NO path_id property, unlike every other analytics event's data object on this channel — see OrderRepromisedAnalytics' own description for why (ADR 0014 §6 / ADR 0019).",
                        "additionalProperties": false,
                        "required": [
                          "order_id",
                          "reason"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          },
                          "cpt_id_old": {
                            "type": "string",
                            "description": "The CPT identity the affected group targeted BEFORE the recompute. Absent for a LeadTime-basis previous promise.",
                            "x-parser-schema-id": "<anonymous-schema-96>"
                          },
                          "cpt_id_new": {
                            "type": "string",
                            "description": "The CPT identity the affected group targets AFTER the recompute. Absent for a LeadTime-basis new promise.",
                            "x-parser-schema-id": "<anonymous-schema-97>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "TaskCPTMissed",
                              "PackageManifested"
                            ],
                            "description": "The fulfillment-execution event_type that triggered this recompute, verbatim.",
                            "x-parser-schema-id": "<anonymous-schema-98>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-94>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-93>"
                  }
                ],
                "x-parser-schema-id": "OrderRepromisedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orderRepromisedAnalytics",
                  "summary": "A missed CPT pushed the promise to a later cutoff.",
                  "payload": {
                    "event_id": "4b5c6d7e-8f9a-4b0c-1d2e-3f4a5b6c7d8e",
                    "event_type": "OrderRepromised",
                    "occurred_at": "2026-09-14T12:00:00Z",
                    "source": "order-management",
                    "schema_version": 1,
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
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "OrderAllocatedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0]",
      "OrderPartiallyAllocatedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[1]",
      "OrderRepromisedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[2]",
      "TaskCPTMissedInbound": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0]",
      "PackageManifestedInbound": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[1]",
      "OrderReceivedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0]",
      "OrderLineAllocatedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[1]",
      "OrderLineBackorderedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[2]",
      "OrderAllocatedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[3]",
      "OrderPartiallyAllocatedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[4]",
      "OrderAllocationPartiallyFailedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[5]",
      "OrderLineReleasedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[6]",
      "OrderReleasedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[7]",
      "OrderCancelledAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[8]",
      "OrderRepromisedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[9]"
    },
    "schemas": {
      "IntegrationEnvelope": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "AnalyticsEnvelope": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[0]",
      "AllocationEvent": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload",
      "RepromisedEvent": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[2].payload",
      "TaskCPTMissedEvent": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload",
      "PackageManifestedEvent": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[1].payload",
      "RepromisedData": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[2].payload.allOf[0].properties.data",
      "TaskCPTMissedData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0].properties.data",
      "PackageManifestedData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[1].payload.allOf[0].properties.data",
      "AllocationData": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0].properties.data",
      "ReleasedLine": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0].properties.data.properties.lines.items",
      "OrderReceivedAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload",
      "OrderAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[3].payload",
      "OrderLineAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[1].payload",
      "OrderLineReleasedAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[6].payload",
      "OrderPartiallyAllocatedAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[4].payload",
      "OrderAllocationPartiallyFailedAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[5].payload",
      "OrderCancelledAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[8].payload",
      "OrderRepromisedAnalyticsEvent": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[9].payload"
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
  