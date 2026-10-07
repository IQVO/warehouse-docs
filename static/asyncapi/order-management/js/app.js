
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Order Management — Domain & Analytics Events",
    "version": "1.0.0",
    "description": "Asynchronous event contract for the **Order Management** bounded context,\nthe generic/supporting context that owns the Order and OrderLine\naggregates: order intake, per-line stock allocation (via\ninventory-storage's reservation API), promise-date calculation, and\nchoreographed release of allocated work (announced to\nwes-work-planning as facts on Kafka — see ADR 0005).\n\n## Message format: CloudEvents 1.0 (mandatory)\n\nEvery message on every channel below — produced AND consumed,\nintegration AND analytics — is a **CloudEvents 1.0** event in Kafka\nstructured content mode (ADR 0030, the fleet-wide standard). There is\nno flat envelope, no dual-write/dual-read, and no envelope toggle.\n\n* Kafka message value: the CloudEvents JSON event format\n  (`application/cloudevents+json`); Kafka header\n  `content-type: application/cloudevents+json; charset=UTF-8`.\n* Required attributes: `specversion` (`1.0`), `id` (UUID, minted once\n  and persisted with the outbox row), `source`\n  (`/warehouse/order-management` for everything this service\n  publishes), `type`\n  (`com.warehouse.wes.order-management.order.<EventName>`), `subject`\n  (the order id), `time` (occurred-at, UTC), `datacontenttype`\n  (`application/json`), `dataschema`\n  (`urn:warehouse:order-management:<events|analytics>:<EventName>:v1`).\n* The same `type` names an occurrence on both topics; `dataschema`\n  distinguishes the integration payload from the analytics payload.\n* `data` is the event payload, unchanged by the envelope migration.\n* Messages on both topics are keyed by the `OrderId` (Hash balancer),\n  preserving per-order ordering. W3C trace context stays in the\n  `traceparent`/`tracestate` headers.\n\nDelivery is at-least-once: consumers dispatch on the FULL `type`,\nignore unknown types, and de-duplicate on `id` (the projector does\nexactly that via its `analytics_processed_events` table). A message\nthat is not a valid CloudEvent is dead-lettered (repromise consumer)\nor logged at WARN and skipped (local-cache consumers, projector).\n\n## Integration contract (frozen for OrderAllocated/OrderPartiallyAllocated;\nadditive for OrderRepromised)\n\n`OrderAllocated`, `OrderPartiallyAllocated`, and — since ADR 0014 §5 /\nADR 0018 — `OrderRepromised` are published to\n`warehouse.order-management.events` — mirroring\ninventory-storage's precedent of forwarding a minimal subset of domain\nevents cross-context. The `data.lines[]` entry shape on the first two\nis shared verbatim with wes-work-planning's Kafka consumer and MUST\nNOT change without coordinating both sides. `fulfillment_class` is\nadditive (ADR 0008). `OrderRepromised` is the fleet's \"your delivery\nis delayed\" trigger, raised by the new `RepromiseOrder` consumer\n(ADR 0018) reacting to fulfillment-execution's `TaskCPTMissed`/\n`PackageManifested` on `warehouse.fulfillment.events`.\n",
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
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.order-management.events": {
      "description": "The outbound integration topic owned by the Order Management bounded context (`kafka.Topic` in the code). `OrderAllocated`/ `OrderPartiallyAllocated` and — since ADR 0018 — `OrderRepromised` are forwarded here; since ADR 0035 the additive, PII-free `SiteSkuDemandChanged` projection is too (keyed by the line-scoped `<order_id>/line/<line_no>`, not the bare order id). Every other domain event is a local concern. wes-work-planning's Kafka consumer derives each line's work unit id from the frozen formula `{orderID}-line-{lineNo}`.",
      "subscribe": {
        "operationId": "consumeOrderManagementEvents",
        "summary": "Consume order allocation-outcome, re-promise, and site/SKU demand integration events.",
        "description": "Subscribe to this channel to learn that an order's allocation-then-release pass concluded, that its promise moved, or that one source order line's site/SKU demand changed. `OrderAllocated` means every line was allocated (and every eligible line released in the same pass); `OrderPartiallyAllocated` means some lines allocated and some backordered on a partial-shipment order. `OrderRepromised` (ADR 0018) means the promise for a shipment group moved, discovered by reacting to a fulfillment-execution fact (a missed CPT or a SLAM pass) — the fleet's \"your delivery is delayed\" trigger. `data.lines[]` on the first two carries exactly the lines released in this pass. `SiteSkuDemandChanged` (ADR 0035) is keyed by `<source_order_id>/line/<line_no>` so one line's demand stream is ordered on its own partition; it is emitted only while `DEMAND_PROJECTION_SITE_ID` is configured, and `state` is `ACTIVE` (line demand exists at the site) or `REMOVED` (cancellation removed it). Consumers must be idempotent (dedupe on `id`) and should ignore CloudEvents `type` values they do not recognise.",
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
              "traits": [
                {
                  "contentType": "application/cloudevents+json",
                  "headers": {
                    "type": "object",
                    "required": [
                      "content-type"
                    ],
                    "properties": {
                      "content-type": {
                        "type": "string",
                        "const": "application/cloudevents+json; charset=UTF-8",
                        "x-parser-schema-id": "<anonymous-schema-341>"
                      },
                      "traceparent": {
                        "type": "string",
                        "description": "W3C trace context of the producing span.",
                        "x-parser-schema-id": "<anonymous-schema-342>"
                      },
                      "tracestate": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-343>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-340>"
                  },
                  "bindings": {
                    "kafka": {
                      "key": {
                        "type": "string",
                        "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                      }
                    }
                  }
                }
              ],
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "description": "CloudEvents 1.0 structured-mode event (JSON event format), the ONLY envelope on every channel this service produces or consumes (ADR 0030, fleet standard). Every attribute below is REQUIRED in this fleet. Kafka header `content-type` is `application/cloudevents+json; charset=UTF-8`; W3C trace context stays in the `traceparent`/`tracestate` headers. Consumers dispatch on the FULL `type`, ignore unknown types, and dedupe on `id`.",
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
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "Minted once per domain event and persisted with the outbox row, so a redelivery carries the same id. `(source, id)` is the consumer idempotency key.",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "description": "/warehouse/<repo-name>, e.g. /warehouse/order-management.",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "type": {
                        "type": "string",
                        "pattern": "^com\\.warehouse\\.[a-z]+\\.[a-z-]+\\.[a-z]+\\.[A-Z][A-Za-z]+(\\.v[0-9]+)?$",
                        "description": "com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      },
                      "subject": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Id of the aggregate instance the event is about (order id for every event this service publishes).",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The domain event's occurred-at instant, UTC, RFC 3339.",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "urn:warehouse:<repo-name>:<events|analytics>:<EventName>:v<N>",
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The event payload — see each message's own data schema.",
                        "x-parser-schema-id": "<anonymous-schema-14>"
                      }
                    },
                    "x-parser-schema-id": "CloudEvent"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderAllocated",
                        "x-parser-schema-id": "<anonymous-schema-17>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:events:OrderAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-18>"
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
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The promise's cutoff instant. Computed by order.PromisePolicy (ADR 0014): a real CPT window's cutoff when promise_basis is \"Capability\", or the per-path lead-time policy's computed instant when promise_basis is \"LeadTime\" (or absent, for events predating ADR 0014).",
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          },
                          "promise_cpt_id": {
                            "type": "string",
                            "description": "The CPT identity (e.g. \"sp1-1800\") this promise targets. Present only when promise_basis is \"Capability\" -- a LeadTime-basis promise has no departure identity.",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime",
                              "Network"
                            ],
                            "description": "Which policy produced promise_date (ADR 0014). \"Network\" (ADR 0020) means the date was DICTATED by an external party's deadline (requiredShipBy) rather than chosen by this service, and is a separate bucket in the analytics promise- basis distribution (ADR 0019). Absent on events published before this ADR.",
                            "x-parser-schema-id": "<anonymous-schema-22>"
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
                                  "x-parser-schema-id": "<anonymous-schema-24>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-25>"
                                },
                                "path_id": {
                                  "type": "string",
                                  "description": "The process path the line was released onto (default \"pick\").",
                                  "x-parser-schema-id": "<anonymous-schema-26>"
                                },
                                "gift_wrap": {
                                  "type": "boolean",
                                  "x-parser-schema-id": "<anonymous-schema-27>"
                                },
                                "fulfillment_class": {
                                  "type": "string",
                                  "enum": [
                                    "SINGLE",
                                    "SAME_SKU_MULTI",
                                    "MULTI_LINE_MULTI"
                                  ],
                                  "description": "Classifies the whole order (ADR 0008); additive field.",
                                  "x-parser-schema-id": "<anonymous-schema-28>"
                                },
                                "promise_cpt_id": {
                                  "type": "string",
                                  "description": "ADR 0017's additive per-line promise field: the CPT identity (e.g. \"sp1-1200\") the PromiseGroup this line belongs to targets. Present only when that group's basis is \"Capability\" and the group has a CPT identity. Absent when the order's promise has no per-group breakdown to attribute this line to (a promise set via the legacy, pre-ADR-0017 single-Promise path). Older consumers can safely ignore it.",
                                  "x-parser-schema-id": "<anonymous-schema-29>"
                                },
                                "promise_basis": {
                                  "type": "string",
                                  "enum": [
                                    "Capability",
                                    "LeadTime",
                                    "Network"
                                  ],
                                  "description": "ADR 0017's additive per-line promise field: which policy produced the PromiseGroup this line belongs to. Absent under the same condition as promise_cpt_id.",
                                  "x-parser-schema-id": "<anonymous-schema-30>"
                                },
                                "promise_cutoff_at": {
                                  "type": "string",
                                  "format": "date-time",
                                  "description": "ADR 0017's additive per-line promise field: the cutoff instant of the PromiseGroup this line belongs to -- may differ from the order-level promise_date on a partial-shipment order whose lines split across multiple groups (promise_date is always the LATEST group's cutoff; an individual line's own group may cut off earlier). Absent under the same condition as promise_cpt_id.",
                                  "x-parser-schema-id": "<anonymous-schema-31>"
                                }
                              },
                              "x-parser-schema-id": "ReleasedLine"
                            },
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          }
                        },
                        "x-parser-schema-id": "AllocationData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-15>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "examples": [
                {
                  "name": "orderAllocated",
                  "summary": "A two-line ship-complete order allocated and released.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderAllocated",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderAllocated:v1",
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
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-2>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-3>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-4>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-1>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:events:OrderPartiallyAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "data": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-37>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-36>"
              },
              "examples": [
                {
                  "name": "orderPartiallyAllocated",
                  "summary": "One line released, one line backordered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                    "subject": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                    "time": "2026-09-07T10:02:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderPartiallyAllocated:v1",
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
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-34>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-35>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-32>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderRepromised",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:events:OrderRepromised:v1",
                        "x-parser-schema-id": "<anonymous-schema-49>"
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
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "cpt_id_old": {
                            "type": "string",
                            "description": "The CPT identity the affected group targeted BEFORE the recompute. Absent for a LeadTime-basis previous promise.",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "cpt_id_new": {
                            "type": "string",
                            "description": "The CPT identity the affected group targets AFTER the recompute. Absent for a LeadTime-basis new promise.",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "TaskCPTMissed",
                              "PackageManifested"
                            ],
                            "description": "The name of the fulfillment-execution event that triggered this recompute (the last segment of its CloudEvents type).",
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          }
                        },
                        "x-parser-schema-id": "RepromisedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-46>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-45>"
              },
              "examples": [
                {
                  "name": "orderRepromised",
                  "summary": "A missed CPT pushed the promise to a later cutoff.",
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
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-42>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-43>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-44>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-41>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "SiteSkuDemandChanged",
              "title": "Site SKU Demand Changed (integration)",
              "summary": "One source order line's site/SKU demand became ACTIVE or REMOVED — the PII-free demand projection for site-level planning (ADR 0035).",
              "description": "Raised inside the same order-save/outbox transaction as the allocation, re-allocation, re-promise, or cancellation that produced the line state, derived purely from the Order aggregate's line (SKU, quantity) plus the explicitly versioned static demand-site scope configured for the deployment (`DEMAND_PROJECTION_SITE_ID`, assignment_version `static-site-v1`). The site is application configuration, never an Order field, and Phase-1 performs no dynamic assignment. subject and the Kafka key are `<source_order_id>/line/<line_no>` — the LINE is the stream identity here, so one line's demand history is totally ordered on its own partition (deliberately not the bare order id every Order* event uses). `due_at` is the line's own promise-group cutoff (ADR 0017) where one is recorded, else the order-level promise date. `demanded_units` is the line quantity; `state` is `ACTIVE` (create / allocate / re-promise) or `REMOVED` (cancellation). No customer PII ever appears on this event.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:events:SiteSkuDemandChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      },
                      "subject": {
                        "type": "string",
                        "pattern": "^.+/line/[1-9][0-9]*$",
                        "examples": [
                          "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2/line/3"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-63>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The `data` payload shape for SiteSkuDemandChanged (ADR 0035): a PII-free snapshot of one source order line's demand at the explicitly configured static site. Deliberately does NOT reuse the frozen allocationData shape shared with wes-work-planning — this is a new, additive consumer contract.",
                        "additionalProperties": false,
                        "required": [
                          "source_order_id",
                          "line_no",
                          "site_id",
                          "sku",
                          "demanded_units",
                          "due_at",
                          "state",
                          "assignment_version"
                        ],
                        "properties": {
                          "source_order_id": {
                            "type": "string",
                            "pattern": "^ord-[0-9a-f-]{36}$",
                            "description": "The order whose line this demand derives from.",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "The 1-based line number within the source order.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "The static demand site this deployment projects every line to (`DEMAND_PROJECTION_SITE_ID`) — application configuration, never an Order field.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The line's SKU. No product attributes, no customer data.",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "demanded_units": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "The line's quantity.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "due_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The line's own promise-group cutoff (ADR 0017) where one is recorded, else the order-level promise date. RFC 3339, UTC.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "state": {
                            "type": "string",
                            "enum": [
                              "ACTIVE",
                              "REMOVED"
                            ],
                            "description": "ACTIVE — the line's demand exists at the site (create / allocate / re-promise). REMOVED — cancellation took it away.",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          },
                          "assignment_version": {
                            "type": "string",
                            "enum": [
                              "static-site-v1"
                            ],
                            "description": "The assignment regime that produced this fact. Phase-1 is the static `static-site-v1`; dynamic assignment must introduce a NEW value, never change this one's meaning.",
                            "x-parser-schema-id": "<anonymous-schema-71>"
                          }
                        },
                        "x-parser-schema-id": "SiteSkuDemandData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-58>"
              },
              "examples": [
                {
                  "name": "siteSkuDemandChangedActive",
                  "summary": "A line's demand becomes ACTIVE at the configured site.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c2d9e1f-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2/line/3",
                    "time": "2026-10-06T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:SiteSkuDemandChanged:v1",
                    "data": {
                      "source_order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 3,
                      "site_id": "SIM1",
                      "sku": "SKU-TOY-0042",
                      "demanded_units": 7,
                      "due_at": "2026-10-08T18:00:00Z",
                      "state": "ACTIVE",
                      "assignment_version": "static-site-v1"
                    }
                  }
                },
                {
                  "name": "siteSkuDemandChangedRemoved",
                  "summary": "Cancellation removes a line's demand at the site.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8d3e0f2a-4b5c-4d6e-9f0a-1b2c3d4e5f6a",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2/line/3",
                    "time": "2026-10-06T15:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:SiteSkuDemandChanged:v1",
                    "data": {
                      "source_order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 3,
                      "site_id": "SIM1",
                      "sku": "SKU-TOY-0042",
                      "demanded_units": 7,
                      "due_at": "2026-10-08T18:00:00Z",
                      "state": "REMOVED",
                      "assignment_version": "static-site-v1"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-55>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-56>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-57>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-54>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "description": "Consumed from warehouse.fulfillment.events (ADR 0018). Re-fires on every sweep pass fulfillment-execution runs, for as long as the task stays overdue (that service's own ADR 0025 §4) — this context's own CloudEvents-id-keyed idempotency gate is what makes that safe to consume. order_ref is a WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), not a bare OrderId.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                        "x-parser-schema-id": "<anonymous-schema-79>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:fulfillment-execution:events:TaskCPTMissed:v1",
                        "x-parser-schema-id": "<anonymous-schema-80>"
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
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "A WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), NOT a bare OrderId.",
                            "x-parser-schema-id": "<anonymous-schema-82>"
                          },
                          "task_type": {
                            "type": "string",
                            "enum": [
                              "PICK",
                              "PACK",
                              "SLAM",
                              "REBIN"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          },
                          "cpt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          }
                        },
                        "x-parser-schema-id": "TaskCPTMissedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-77>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-76>"
              },
              "examples": [
                {
                  "name": "taskCPTMissed",
                  "summary": "A PICK task for order line 2 is still open past its CPT.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
                    "subject": "task-42",
                    "time": "2026-09-14T11:59:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCPTMissed:v1",
                    "data": {
                      "task_id": "task-42",
                      "order_ref": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-2",
                      "task_type": "PICK",
                      "cpt": "2026-09-14T11:55:00Z"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-73>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-74>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-75>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-72>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/fulfillment-execution",
                        "x-parser-schema-id": "<anonymous-schema-91>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                        "x-parser-schema-id": "<anonymous-schema-92>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                        "x-parser-schema-id": "<anonymous-schema-93>"
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
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          },
                          "order_ref": {
                            "type": "string",
                            "description": "A WorkUnitId-shaped reference (`{orderId}-line-{lineNo}`), NOT a bare OrderId.",
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          }
                        },
                        "x-parser-schema-id": "PackageManifestedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-90>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-89>"
              },
              "examples": [
                {
                  "name": "packageManifested",
                  "summary": "A package for order line 1 passed SLAM.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                    "subject": "pkg-99",
                    "time": "2026-09-14T12:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                    "data": {
                      "package_id": "pkg-99",
                      "order_ref": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-1"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-86>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-87>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-88>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-85>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.process-path-management.events": {
      "description": "process-path-management's integration topic. Replayed from FirstOffset under per-process-unique consumer groups by two local caches: the process-path catalogue (ProcessPath*) and the CPT schedule cache (CPTScheduleChanged). Every other CloudEvents `type` is ignored; a non-CloudEvents message is logged at WARN and skipped.",
      "subscribe": {
        "operationId": "consumeProcessPathEvents",
        "summary": "Maintain the local process-path catalogue and CPT schedule caches.",
        "description": "Dispatch is on the FULL CloudEvents type: com.warehouse.wes.process-path-management.processpath.ProcessPathCreated/Updated/Deactivated feed the catalogue (ADR 0013/0016), and com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged feeds the CPT schedule cache (ADR 0014). Each event is a last-write-wins snapshot, so re-applying one is idempotent.",
        "tags": [
          {
            "name": "order-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "ProcessPathCreated (inbound)",
              "summary": "A process path was defined.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-102>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      },
                      "data": {
                        "type": "object",
                        "description": "process-path-management's ProcessPath* payload, decoded independently here (only the fields this service reads). eligibility is absent on ProcessPathDeactivated.",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "cycle_time_p95": {
                            "type": "string",
                            "description": "Go time.Duration string, e.g. 45m0s.",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "eligibility": {
                            "type": "object",
                            "properties": {
                              "max_units_per_line": {
                                "type": "integer",
                                "x-parser-schema-id": "<anonymous-schema-109>"
                              },
                              "required_product_attributes": {
                                "type": "array",
                                "items": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-111>"
                                },
                                "x-parser-schema-id": "<anonymous-schema-110>"
                              },
                              "excluded_product_attributes": {
                                "type": "array",
                                "items": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-113>"
                                },
                                "x-parser-schema-id": "<anonymous-schema-112>"
                              },
                              "non_sortable": {
                                "type": "boolean",
                                "x-parser-schema-id": "<anonymous-schema-114>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-115>"
                          }
                        },
                        "x-parser-schema-id": "ProcessPathData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-101>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-100>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-97>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-98>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-99>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-96>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "ProcessPathUpdated",
              "title": "ProcessPathUpdated (inbound)",
              "summary": "A process path definition changed.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-122>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-121>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-120>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-117>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-118>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-119>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-116>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "ProcessPathDeactivated (inbound)",
              "summary": "A process path was deactivated.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-131>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                        "x-parser-schema-id": "<anonymous-schema-132>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                        "x-parser-schema-id": "<anonymous-schema-133>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-130>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-129>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-126>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-127>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-128>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-125>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "CPTScheduleChanged",
              "title": "CPTScheduleChanged (inbound)",
              "summary": "A site's full CPT schedule snapshot.",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-140>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                        "x-parser-schema-id": "<anonymous-schema-141>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:CPTScheduleChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-142>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Full per-site CPT schedule snapshot (replaces the site's prior schedule).",
                        "required": [
                          "site_id",
                          "timezone",
                          "cutoffs"
                        ],
                        "properties": {
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          },
                          "timezone": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-144>"
                          },
                          "cutoffs": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "required": [
                                "cpt_id",
                                "local_time"
                              ],
                              "properties": {
                                "cpt_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-147>"
                                },
                                "local_time": {
                                  "type": "string",
                                  "description": "HH:MM in the site timezone.",
                                  "x-parser-schema-id": "<anonymous-schema-148>"
                                },
                                "days_of_week": {
                                  "type": "array",
                                  "items": {
                                    "type": "string",
                                    "x-parser-schema-id": "<anonymous-schema-150>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-149>"
                                },
                                "ship_method": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-151>"
                                },
                                "eligible_path_ids": {
                                  "type": "array",
                                  "items": {
                                    "type": "string",
                                    "x-parser-schema-id": "<anonymous-schema-153>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-152>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-146>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-145>"
                          }
                        },
                        "x-parser-schema-id": "CPTScheduleData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-139>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-138>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-135>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-136>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-137>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-134>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.work-planning.events": {
      "description": "wes-work-planning's integration topic. Replayed from FirstOffset by the path-capacity local cache (ADR 0015), which acts only on PathCapacityChanged; every other CloudEvents `type` is ignored and a non-CloudEvents message is logged at WARN and skipped.",
      "subscribe": {
        "operationId": "consumeWorkPlanningEvents",
        "summary": "Maintain the local remaining-capacity cache.",
        "description": "Dispatch is on the FULL CloudEvents type com.warehouse.wes.work-planning.workpool.PathCapacityChanged; the cache is keyed by (path_id, cutoff_at) and each event is a last-write-wins observation.",
        "tags": [
          {
            "name": "order-management"
          }
        ],
        "message": {
          "name": "PathCapacityChanged",
          "title": "PathCapacityChanged (inbound)",
          "summary": "Remaining capacity for a path at an exact cutoff instant (ADR 0015).",
          "tags": [
            {
              "name": "order-management"
            }
          ],
          "traits": [
            "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "source": {
                    "const": "/warehouse/wes-work-planning",
                    "x-parser-schema-id": "<anonymous-schema-160>"
                  },
                  "type": {
                    "const": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                    "x-parser-schema-id": "<anonymous-schema-161>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                    "x-parser-schema-id": "<anonymous-schema-162>"
                  },
                  "data": {
                    "type": "object",
                    "description": "wes-work-planning's PathCapacityChanged payload (ADR 0015).",
                    "required": [
                      "path_id",
                      "cutoff_at",
                      "remaining_units",
                      "known"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-163>"
                      },
                      "cutoff_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-164>"
                      },
                      "remaining_units": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-165>"
                      },
                      "known": {
                        "type": "boolean",
                        "x-parser-schema-id": "<anonymous-schema-166>"
                      }
                    },
                    "x-parser-schema-id": "PathCapacityData"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-159>"
              }
            ],
            "x-parser-schema-id": "<anonymous-schema-158>"
          },
          "contentType": "application/cloudevents+json",
          "headers": {
            "type": "object",
            "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
            "properties": {
              "content-type": {
                "type": "string",
                "const": "application/cloudevents+json; charset=UTF-8",
                "x-parser-schema-id": "<anonymous-schema-155>"
              },
              "traceparent": {
                "type": "string",
                "description": "W3C trace context of the producing span.",
                "x-parser-schema-id": "<anonymous-schema-156>"
              },
              "tracestate": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-157>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-154>"
          },
          "bindings": {
            "kafka": {
              "key": {
                "type": "string",
                "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
              }
            }
          }
        }
      }
    },
    "warehouse.warehouse-planning.events": {
      "description": "warehouse-planning's integration topic (key and CloudEvents subject = the capacity plan id). Consumed under a STABLE shared consumer group (env `PLANNED_CAPACITY_CONSUMER_GROUP`, ADR 0031) — a normal process-and-commit consumer, not a full-replay cache. Every other CloudEvents `type` is ignored; a message that is not a valid CloudEvent, or whose payload cannot be applied, is dead-lettered to `warehouse.warehouse-planning.events.dlq` and committed past.",
      "subscribe": {
        "operationId": "consumeWarehousePlanningEvents",
        "summary": "Maintain the local planned-capacity read model.",
        "description": "Dispatch is on the FULL CloudEvents type. CapacityPlanCreated stores a DRAFT row; CapacityPlanPublished and CapacityShortageDetected store a PUBLISHED row; BottleneckDetected is recognised and ignored (its bottleneck_step is already carried by CapacityShortageDetected). The row is keyed by plan id with last-writer-wins on the CloudEvents `time` (a DRAFT never replaces a PUBLISHED row). The idempotency claim on the CloudEvents `id` and the upsert commit in ONE database transaction; the Kafka offset is committed only afterwards. Only a PUBLISHED plan with `shortage > 0` ever influences an order (ADR 0031). These contracts are warehouse-planning's own — see its apis/asyncapi.yaml — decoded independently here, never imported.",
        "tags": [
          {
            "name": "order-management"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "CapacityPlanCreated",
              "title": "CapacityPlanCreated (inbound, warehouse-planning)",
              "summary": "A DRAFT capacity plan exists (stored as DRAFT; never influences an order).",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/warehouse-planning",
                        "x-parser-schema-id": "<anonymous-schema-173>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanCreated",
                        "x-parser-schema-id": "<anonymous-schema-174>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityPlanCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-175>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The fields order-management reads from warehouse-planning's CapacityPlanCreated / CapacityPlanPublished / CapacityShortageDetected payloads (its own apis/asyncapi.yaml; extra fields such as path_capacity, status and published_at are ignored). Quantities are orders; times are RFC 3339 UTC; window_end is exclusive.",
                        "required": [
                          "plan_id",
                          "location",
                          "window_start",
                          "window_end",
                          "shortage"
                        ],
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "description": "The CapacityPlan id; equals the CloudEvents subject.",
                            "x-parser-schema-id": "<anonymous-schema-176>"
                          },
                          "warehouse_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-177>"
                          },
                          "location": {
                            "type": "string",
                            "description": "Site/building code, e.g. SIM1.",
                            "x-parser-schema-id": "<anonymous-schema-178>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-179>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-180>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-181>"
                          },
                          "assigned_demand": {
                            "type": "number",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-182>"
                          },
                          "capacity_over_window": {
                            "type": "number",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-183>"
                          },
                          "shortage": {
                            "type": "number",
                            "format": "double",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-184>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-185>"
                          }
                        },
                        "x-parser-schema-id": "CapacityPlanData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-172>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-171>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-168>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-169>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-170>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-167>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "CapacityPlanPublished",
              "title": "CapacityPlanPublished (inbound, warehouse-planning)",
              "summary": "A capacity plan was published (stored as PUBLISHED).",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/warehouse-planning",
                        "x-parser-schema-id": "<anonymous-schema-192>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished",
                        "x-parser-schema-id": "<anonymous-schema-193>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityPlanPublished:v1",
                        "x-parser-schema-id": "<anonymous-schema-194>"
                      },
                      "data": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-191>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-190>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-187>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-188>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-189>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-186>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "CapacityShortageDetected",
              "title": "CapacityShortageDetected (inbound, warehouse-planning)",
              "summary": "A published plan's demand exceeds its capacity over the window (stored as PUBLISHED with its shortage).",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/warehouse-planning",
                        "x-parser-schema-id": "<anonymous-schema-201>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityShortageDetected",
                        "x-parser-schema-id": "<anonymous-schema-202>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:CapacityShortageDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-203>"
                      },
                      "data": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-200>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-199>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-196>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-197>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-198>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-195>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
            },
            {
              "name": "BottleneckDetected",
              "title": "BottleneckDetected (inbound, warehouse-planning)",
              "summary": "The path step limiting a plan with a shortage (recognised and ignored: CapacityShortageDetected carries bottleneck_step).",
              "tags": [
                {
                  "name": "order-management"
                }
              ],
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/warehouse-planning",
                        "x-parser-schema-id": "<anonymous-schema-210>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.warehouse-planning.capacityplan.BottleneckDetected",
                        "x-parser-schema-id": "<anonymous-schema-211>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:warehouse-planning:events:BottleneckDetected:v1",
                        "x-parser-schema-id": "<anonymous-schema-212>"
                      },
                      "data": {
                        "type": "object",
                        "description": "warehouse-planning's BottleneckDetected payload (recognised, not applied).",
                        "properties": {
                          "plan_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-213>"
                          },
                          "bottleneck_step": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-214>"
                          },
                          "path_capacity": {
                            "type": "number",
                            "format": "double",
                            "x-parser-schema-id": "<anonymous-schema-215>"
                          }
                        },
                        "x-parser-schema-id": "BottleneckData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-209>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-208>"
              },
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-205>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-206>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-207>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-204>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
        "description": "order-management publishes each domain event (enriched with its process path via an OrderRepo lookup) as a CloudEvents 1.0 event whose dataschema is urn:warehouse:order-management:analytics:<EventName>:v1. Unrecognised event types are skipped by the publisher, so this channel only ever carries the ten types listed under subscribe below. Since ADR 0019, OrderAllocated/ OrderPartiallyAllocated additionally carry promise_basis/ promise_cutoff_at/split_shipment (ADR 0014 §6's promise KPIs), and OrderRepromised (ADR 0018) is published here too, deliberately WITHOUT a path_id — see OrderRepromisedAnalytics below.",
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
        "description": "cmd/order-projector consumes this topic from FirstOffset and is the ONLY writer of the analytical Postgres. It is idempotent on the CloudEvents id; a redelivery is always a no-op. The report keyed per path x hour (Order Funnel & Allocation Health) reads what this projection writes; since ADR 0019 it also derives promise basis distribution, re-promise rate, split-shipment rate, and promise-to-cutoff gap from this same stream.",
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-222>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderReceived",
                        "x-parser-schema-id": "<anonymous-schema-223>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-224>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-225>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-226>"
                          },
                          "line_count": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-227>"
                          }
                        },
                        "x-parser-schema-id": "OrderReceivedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-221>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-220>"
              },
              "examples": [
                {
                  "name": "orderReceived",
                  "summary": "A two-line order was received on the pick path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderReceived",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderReceived:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick",
                      "line_count": 2
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-217>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-218>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-219>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-216>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-234>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderLineAllocated",
                        "x-parser-schema-id": "<anonymous-schema-235>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderLineAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-236>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-237>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-238>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-239>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-240>"
                          }
                        },
                        "x-parser-schema-id": "OrderLineAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-233>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-232>"
              },
              "examples": [
                {
                  "name": "orderLineAllocated",
                  "summary": "Line 1 of an order was allocated.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "d2e3f4a5-6b7c-4d8e-9f0a-1b2c3d4e5f6a",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderLineAllocated",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:00:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderLineAllocated:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 1,
                      "path_id": "pick",
                      "sku": "SKU-BOOK-0001"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-229>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-230>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-231>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-228>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-247>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderLineBackordered",
                        "x-parser-schema-id": "<anonymous-schema-248>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderLineBackordered:v1",
                        "x-parser-schema-id": "<anonymous-schema-249>"
                      },
                      "data": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[1].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-246>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-245>"
              },
              "examples": [
                {
                  "name": "orderLineBackordered",
                  "summary": "Line 2 was backordered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "e3f4a5b6-7c8d-4e9f-0a1b-2c3d4e5f6a7b",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderLineBackordered",
                    "subject": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                    "time": "2026-09-07T10:00:31Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderLineBackordered:v1",
                    "data": {
                      "order_id": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                      "line_no": 2,
                      "path_id": "pick",
                      "sku": "SKU-TOY-9999"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-242>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-243>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-244>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-241>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-256>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderAllocated",
                        "x-parser-schema-id": "<anonymous-schema-257>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-258>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-259>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-260>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime",
                              "Network"
                            ],
                            "description": "ADR 0014 §6 / ADR 0019's additive promise-basis- distribution field, mirrored from the OrderAllocated domain event's own promise_basis. Absent on events published before this ADR, or when the underlying promise had no basis recorded.",
                            "x-parser-schema-id": "<anonymous-schema-261>"
                          },
                          "promise_cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "ADR 0014 §6 / ADR 0019's additive promise-to-cutoff-gap source field: the promise's cutoff instant. Present ONLY when promise_basis is \"Capability\" — a LeadTime-basis promise's \"cutoff\" is just now-plus-a-configured-duration, not a real departure, and is deliberately excluded from the gap KPI.",
                            "x-parser-schema-id": "<anonymous-schema-262>"
                          },
                          "split_shipment": {
                            "type": "boolean",
                            "description": "ADR 0014 §6 / ADR 0019's additive split-shipment-rate source field: true when the order had more than one order.PromiseGroup at allocation time (ADR 0014 §3 / ADR 0017), derived via an OrderRepo lookup at publish time.",
                            "x-parser-schema-id": "<anonymous-schema-263>"
                          }
                        },
                        "x-parser-schema-id": "OrderAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-255>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-254>"
              },
              "examples": [
                {
                  "name": "orderAllocatedAnalytics",
                  "summary": "An order concluded its pass fully allocated on pick.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "f4a5b6c7-8d9e-4f0a-1b2c-3d4e5f6a7b8c",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderAllocated",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderAllocated:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-251>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-252>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-253>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-250>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-270>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                        "x-parser-schema-id": "<anonymous-schema-271>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderPartiallyAllocated:v1",
                        "x-parser-schema-id": "<anonymous-schema-272>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-273>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-274>"
                          },
                          "allocated_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-275>"
                          },
                          "backordered_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-276>"
                          },
                          "promise_basis": {
                            "type": "string",
                            "enum": [
                              "Capability",
                              "LeadTime",
                              "Network"
                            ],
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-277>"
                          },
                          "promise_cutoff_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-278>"
                          },
                          "split_shipment": {
                            "type": "boolean",
                            "description": "Same ADR 0014 §6 / ADR 0019 field as OrderAnalyticsEvent's.",
                            "x-parser-schema-id": "<anonymous-schema-279>"
                          }
                        },
                        "x-parser-schema-id": "OrderPartiallyAllocatedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-269>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-268>"
              },
              "examples": [
                {
                  "name": "orderPartiallyAllocatedAnalytics",
                  "summary": "One line allocated, one backordered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "a5b6c7d8-9e0f-4a1b-2c3d-4e5f6a7b8c9d",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                    "subject": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                    "time": "2026-09-07T10:02:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderPartiallyAllocated:v1",
                    "data": {
                      "order_id": "ord-1b2f1e0a-5f4f-4a67-9c1e-6e2f3a4b5c6d",
                      "path_id": "pick",
                      "allocated_lines": 1,
                      "backordered_lines": 1
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-265>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-266>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-267>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-264>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-286>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderAllocationPartiallyFailed",
                        "x-parser-schema-id": "<anonymous-schema-287>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderAllocationPartiallyFailed:v1",
                        "x-parser-schema-id": "<anonymous-schema-288>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-289>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-290>"
                          },
                          "allocated_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-291>"
                          },
                          "remaining_lines": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-292>"
                          }
                        },
                        "x-parser-schema-id": "OrderAllocationPartiallyFailedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-285>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-284>"
              },
              "examples": [
                {
                  "name": "orderAllocationPartiallyFailed",
                  "summary": "One line allocated before inventory-storage became unreachable.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "b6c7d8e9-0f1a-4b2c-3d4e-5f6a7b8c9d0e",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderAllocationPartiallyFailed",
                    "subject": "ord-3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
                    "time": "2026-09-07T10:03:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderAllocationPartiallyFailed:v1",
                    "data": {
                      "order_id": "ord-3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
                      "path_id": "pick",
                      "allocated_lines": 1,
                      "remaining_lines": 1
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-281>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-282>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-283>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-280>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-299>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderLineReleased",
                        "x-parser-schema-id": "<anonymous-schema-300>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderLineReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-301>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-302>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-303>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-304>"
                          },
                          "work_unit_id": {
                            "type": "string",
                            "description": "{order_id}-line-{line_no} — deterministic, derived by BOTH sides.",
                            "x-parser-schema-id": "<anonymous-schema-305>"
                          }
                        },
                        "x-parser-schema-id": "OrderLineReleasedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-298>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-297>"
              },
              "examples": [
                {
                  "name": "orderLineReleased",
                  "summary": "Line 1 released onto the pick path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c7d8e9f0-1a2b-4c3d-4e5f-6a7b8c9d0e1f",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderLineReleased",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:01:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderLineReleased:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "line_no": 1,
                      "path_id": "pick",
                      "work_unit_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2-line-1"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-294>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-295>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-296>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-293>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-312>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderReleased",
                        "x-parser-schema-id": "<anonymous-schema-313>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderReleased:v1",
                        "x-parser-schema-id": "<anonymous-schema-314>"
                      },
                      "data": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[3].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-311>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-310>"
              },
              "examples": [
                {
                  "name": "orderReleased",
                  "summary": "The order fully released on the pick path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "d8e9f0a1-2b3c-4d4e-5f6a-7b8c9d0e1f2a",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderReleased",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-07T10:01:31Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderReleased:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "path_id": "pick"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-307>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-308>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-309>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-306>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-321>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderCancelled",
                        "x-parser-schema-id": "<anonymous-schema-322>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderCancelled:v1",
                        "x-parser-schema-id": "<anonymous-schema-323>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-324>"
                          },
                          "path_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-325>"
                          },
                          "revoked_reservations": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-326>"
                          }
                        },
                        "x-parser-schema-id": "OrderCancelledAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-320>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-319>"
              },
              "examples": [
                {
                  "name": "orderCancelled",
                  "summary": "A pre-release order was cancelled, revoking one reservation.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "e9f0a1b2-3c4d-4e5f-6a7b-8c9d0e1f2a3b",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderCancelled",
                    "subject": "ord-4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a",
                    "time": "2026-09-07T10:04:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderCancelled:v1",
                    "data": {
                      "order_id": "ord-4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a",
                      "path_id": "pick",
                      "revoked_reservations": 1
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-316>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-317>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-318>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-315>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
                }
              }
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
              "traits": [
                "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "const": "/warehouse/order-management",
                        "x-parser-schema-id": "<anonymous-schema-333>"
                      },
                      "type": {
                        "const": "com.warehouse.wes.order-management.order.OrderRepromised",
                        "x-parser-schema-id": "<anonymous-schema-334>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:order-management:analytics:OrderRepromised:v1",
                        "x-parser-schema-id": "<anonymous-schema-335>"
                      },
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
                            "x-parser-schema-id": "<anonymous-schema-336>"
                          },
                          "cpt_id_old": {
                            "type": "string",
                            "description": "The CPT identity the affected group targeted BEFORE the recompute. Absent for a LeadTime-basis previous promise.",
                            "x-parser-schema-id": "<anonymous-schema-337>"
                          },
                          "cpt_id_new": {
                            "type": "string",
                            "description": "The CPT identity the affected group targets AFTER the recompute. Absent for a LeadTime-basis new promise.",
                            "x-parser-schema-id": "<anonymous-schema-338>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "TaskCPTMissed",
                              "PackageManifested"
                            ],
                            "description": "The name of the fulfillment-execution event that triggered this recompute (the last segment of its CloudEvents type).",
                            "x-parser-schema-id": "<anonymous-schema-339>"
                          }
                        },
                        "x-parser-schema-id": "OrderRepromisedAnalyticsData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-332>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-331>"
              },
              "examples": [
                {
                  "name": "orderRepromisedAnalytics",
                  "summary": "A missed CPT pushed the promise to a later cutoff.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4b5c6d7e-8f9a-4b0c-1d2e-3f4a5b6c7d8e",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderRepromised",
                    "subject": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                    "time": "2026-09-14T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:analytics:OrderRepromised:v1",
                    "data": {
                      "order_id": "ord-7c9e6679-7d5a-4b37-b2f1-93b0c4a1d8f2",
                      "cpt_id_old": "sp1-1200",
                      "cpt_id_new": "sp1-1800",
                      "reason": "TaskCPTMissed"
                    }
                  }
                }
              ],
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0].headers.required",
                "properties": {
                  "content-type": {
                    "type": "string",
                    "const": "application/cloudevents+json; charset=UTF-8",
                    "x-parser-schema-id": "<anonymous-schema-328>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the producing span.",
                    "x-parser-schema-id": "<anonymous-schema-329>"
                  },
                  "tracestate": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-330>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-327>"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "The aggregate id (also the CloudEvents subject); Hash-partitioned."
                  }
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
      "OrderAllocatedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0]",
      "OrderPartiallyAllocatedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[1]",
      "OrderRepromisedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[2]",
      "SiteSkuDemandChangedIntegration": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[3]",
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
      "OrderRepromisedAnalytics": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[9]",
      "ProcessPathCreatedInbound": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0]",
      "ProcessPathUpdatedInbound": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[1]",
      "ProcessPathDeactivatedInbound": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[2]",
      "CPTScheduleChangedInbound": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[3]",
      "PathCapacityChangedInbound": "$ref:$.channels.warehouse.work-planning.events.subscribe.message",
      "CapacityPlanCreatedInbound": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0]",
      "CapacityPlanPublishedInbound": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[1]",
      "CapacityShortageDetectedInbound": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[2]",
      "BottleneckDetectedInbound": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[3]"
    },
    "messageTraits": {
      "CloudEventsStructured": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].traits[0]"
    },
    "schemas": {
      "CloudEvent": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "RepromisedData": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data",
      "SiteSkuDemandData": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "TaskCPTMissedData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "PackageManifestedData": "$ref:$.channels.warehouse.fulfillment.events.subscribe.message.oneOf[1].payload.allOf[1].properties.data",
      "AllocationData": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "ReleasedLine": "$ref:$.channels.warehouse.order-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
      "OrderReceivedAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "OrderAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "OrderLineAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[1].payload.allOf[1].properties.data",
      "OrderLineReleasedAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[6].payload.allOf[1].properties.data",
      "OrderPartiallyAllocatedAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[4].payload.allOf[1].properties.data",
      "OrderAllocationPartiallyFailedAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[5].payload.allOf[1].properties.data",
      "OrderCancelledAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[8].payload.allOf[1].properties.data",
      "OrderRepromisedAnalyticsData": "$ref:$.channels.warehouse.order-management.analytics.subscribe.message.oneOf[9].payload.allOf[1].properties.data",
      "ProcessPathData": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "CPTScheduleData": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "PathCapacityData": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.payload.allOf[1].properties.data",
      "CapacityPlanData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "BottleneckData": "$ref:$.channels.warehouse.warehouse-planning.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data"
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
  