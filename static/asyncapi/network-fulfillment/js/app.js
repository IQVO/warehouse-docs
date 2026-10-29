
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Network Fulfillment Events",
    "version": "2.0.0",
    "description": "Domain-event catalog for **Network Fulfillment**, a Supporting bounded\ncontext in the WES (Warehouse Execution Systems) subdomain: the\nanti-corruption layer between the warehouse-systems fleet and an\nexternal retail fulfillment network. One aggregate raises every event\ndocumented here:\n\n- `NetworkOrder` (package `internal/domain/networkorder`) — one network\n  purchase order and its acknowledgement lifecycle. Raises\n  `NetworkOrderReceived`, `NetworkOrderSubmitted`,\n  `NetworkOrderAcknowledged` (v2: raised when the order settles\n  `ACKNOWLEDGED`, ADR 0016), `NetworkOrderRejected`,\n  `NetworkOrderShipmentConfirmed` and (from the\n  acknowledgement sweep, without a state transition)\n  `AcknowledgementDeadlineAtRisk`; and (from the orphaned-hold sweep,\n  ADR 0024, also without a state transition) `OrphanedHoldCancelled`.\n\n**Envelope (mandatory, ADR 0008).** Every message on every channel of\nthis service is a CloudEvents 1.0 event in *structured content mode*\n(Kafka protocol binding): the Kafka message value is the JSON event\nformat, content type `application/cloudevents+json`, and every message\ncarries the Kafka header\n`content-type: application/cloudevents+json; charset=UTF-8`. There is no\nother envelope. All of `specversion`, `id`, `source`, `type`, `subject`,\n`time`, `datacontenttype` and `dataschema` are REQUIRED. W3C trace\ncontext, when present, travels in Kafka headers, never as extension\nattributes: an event written through the transactional outbox inside a\nspan carries that span's `traceparent` (and `tracestate` / `baggage`\nwhen present), stored with the outbox row and sent by the relay\n(ADR 0022). Consumers may extract these headers and must not require\nthem. The Kafka message key is the network order reference\n(`networkRef`, identical to `subject`), so every event for one order\nlands on the same partition.\n\n**Type naming.** `type` is\n`com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>`. For\nthis context the subdomain is `wes`, the bounded context is\n`network-fulfillment` and the entity is `networkorder`, e.g.\n`com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived`.\nThe SAME `type` is used for the occurrence on the integration and on\nthe analytics channel; `dataschema`\n(`urn:warehouse:network-fulfillment:<events|analytics>:<EventName>:v<N>`)\nnames the payload shape. A breaking change gets a new `.v2`\ntype and a new dataschema version, never a mutation of these:\n`NetworkOrderAcknowledged` changed meaning in ADR 0016 and is published\nas `...networkorder.NetworkOrderAcknowledged.v2` /\n`...:NetworkOrderAcknowledged:v2`.\n\n**Consumers** must dispatch on the full `type`, ignore unknown types,\ndedupe on `id` (stable across outbox redelivery), and dead-letter or\nskip — never parse as a legacy shape — anything that fails CloudEvents\nvalidation.\n",
    "contact": {
      "name": "Network Fulfillment — IQVO",
      "url": "https://github.com/IQVO/network-fulfillment",
      "email": "claudioed.oliveira@gmail.com"
    },
    "license": {
      "name": "MIT",
      "url": "https://opensource.org/licenses/MIT"
    }
  },
  "tags": [
    {
      "name": "network-fulfillment",
      "description": "The Network Fulfillment bounded context (WES subdomain) — the ACL\nbetween the fleet and the external retail fulfillment network.\n"
    },
    {
      "name": "networkorder",
      "description": "Events raised by the `NetworkOrder` aggregate."
    },
    {
      "name": "analytics",
      "description": "The internal analytics stream consumed by this service's own\nacknowledgement-report projector.\n"
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Shared warehouse-systems Kafka cluster."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.network-fulfillment.events": {
      "description": "The integration topic (the `Topic` constant in\n`internal/adapters/outbound/kafka/publisher.go`). Every domain event\nthe `NetworkOrder` aggregate raises is published here, via the\ntransactional outbox when `DATABASE_URL` is configured (ADR 0003).\ndataschema: `urn:warehouse:network-fulfillment:events:<EventName>:v<N>`\n(v1, except `NetworkOrderAcknowledged` which is v2 — ADR 0016).\n",
      "subscribe": {
        "operationId": "consumeNetworkFulfillmentEvents",
        "summary": "Consume Network Fulfillment integration events.",
        "description": "Every message is a CloudEvents 1.0 structured-mode event; route on\nthe full `type` attribute.\n",
        "tags": [
          {
            "name": "network-fulfillment"
          }
        ],
        "message": {
          "oneOf": [
            {
              "x-no-consumer-reason": "facts of the external-network channel, no consumer by decision (K19)",
              "name": "NetworkOrderReceived",
              "title": "Network order received",
              "summary": "Demand from the external retail network was turned into a NetworkOrder; the 24h acknowledgement clock is running.",
              "description": "Raised by the `NetworkOrder` aggregate the moment network demand is received — whether or not every line could be translated into our SKU vocabulary. `lineCount` is the number of successfully translated lines (0 for demand rejected as untranslatable).\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived` — `dataschema`: `urn:warehouse:network-fulfillment:events:NetworkOrderReceived:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": {
                "type": "object",
                "required": [
                  "content-type"
                ],
                "properties": {
                  "content-type": {
                    "type": "string",
                    "description": "Structured content mode media type.",
                    "enum": [
                      "application/cloudevents+json; charset=UTF-8"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-1>"
                  },
                  "traceparent": {
                    "type": "string",
                    "description": "W3C trace context of the span that wrote the event (outbox\nmode, ADR 0022), when there was one. Optional.\n",
                    "x-parser-schema-id": "<anonymous-schema-2>"
                  },
                  "tracestate": {
                    "type": "string",
                    "description": "W3C trace state, when present. Optional.",
                    "x-parser-schema-id": "<anonymous-schema-3>"
                  },
                  "baggage": {
                    "type": "string",
                    "description": "W3C baggage, when the writing request carried any. Optional.",
                    "x-parser-schema-id": "<anonymous-schema-4>"
                  }
                },
                "x-parser-schema-id": "KafkaHeaders"
              },
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "NetworkOrderReceived CloudEvent (events)",
                "allOf": [
                  {
                    "type": "object",
                    "title": "CloudEvents 1.0 envelope (structured mode)",
                    "description": "The single envelope every message of this service uses. Each event\nschema below composes it with `allOf` and pins `type`,\n`dataschema` and the `data` shape. No other envelope exists.\n",
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
                        "description": "CloudEvents specification version.",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "UUID v4 minted once per occurrence and persisted with the outbox\nrow, so a redelivery carries the same id. `(source, id)` is the\nconsumer idempotency key.\n",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "enum": [
                          "/warehouse/network-fulfillment"
                        ],
                        "description": "The producing service.",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "type": {
                        "type": "string",
                        "pattern": "^com\\.warehouse\\.wes\\.network-fulfillment\\.networkorder\\.[A-Z][A-Za-z]+(\\.v[0-9]+)?$",
                        "description": "`com.warehouse.wes.network-fulfillment.networkorder.<EventName>`, with a `.v<N>` suffix for a breaking version (e.g. `NetworkOrderAcknowledged.v2`, ADR 0016).",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "subject": {
                        "type": "string",
                        "minLength": 1,
                        "description": "The network order reference (networkRef) the event is about.",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The domain event's occurred-at instant, UTC, RFC 3339.",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "enum": [
                          "application/json"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "pattern": "^urn:warehouse:network-fulfillment:(events|analytics):[A-Z][A-Za-z]+:v[0-9]+$",
                        "description": "Names the payload shape and stream.",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The domain event payload.",
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      }
                    },
                    "x-parser-schema-id": "CloudEvent"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived",
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:NetworkOrderReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "data": {
                        "type": "object",
                        "title": "NetworkOrderReceived payload",
                        "required": [
                          "networkRef",
                          "siteId",
                          "requiredShipBy",
                          "acknowledgeBy",
                          "lineCount",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference (this context's NetworkRef). Also the CloudEvents `subject` and the Kafka key.",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "requiredShipBy": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Ship-by deadline the network demands.",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "acknowledgeBy": {
                            "type": "string",
                            "format": "date-time",
                            "description": "End of the acknowledgement window.",
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          },
                          "lineCount": {
                            "type": "integer",
                            "description": "Number of lines translated into our vocabulary.",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Domain occurred-at (same instant as the CloudEvents `time`).",
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          }
                        },
                        "x-parser-schema-id": "NetworkOrderReceivedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-14>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderReceivedEvent"
              },
              "examples": [
                {
                  "name": "networkOrderReceived",
                  "summary": "Network order received for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderReceived:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "requiredShipBy": "2026-09-25T08:00:00Z",
                      "acknowledgeBy": "2026-09-24T08:00:00Z",
                      "lineCount": 2,
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "facts of the external-network channel, no consumer by decision (K19)",
              "name": "NetworkOrderSubmitted",
              "title": "Network order submitted",
              "summary": "We told the network yes (the order is SUBMITTED) and a held order exists in order-management; the submission is not yet reconciled.",
              "description": "Raised by the `NetworkOrder` aggregate in the same atomic scope that moves the order to `SUBMITTED` (ADR 0016): the decision to accept in full has been taken, the network has been told yes and a held order exists in order-management (`localOrderId`), but the submission is only accepted-for-processing and NOT yet reconciled against the network's transaction-status record (ADR 0001 §5). It is exactly what `NetworkOrderAcknowledged` v1 used to announce. A consumer must not treat it as a settled commitment: the settle is `NetworkOrderAcknowledged` (v2); a refused submission is `NetworkOrderRejected` with `reason=SUBMISSION_FAILED`.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted` — `dataschema`: `urn:warehouse:network-fulfillment:events:NetworkOrderSubmitted:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "NetworkOrderSubmitted CloudEvent (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted",
                        "x-parser-schema-id": "<anonymous-schema-24>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:NetworkOrderSubmitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-25>"
                      },
                      "data": {
                        "type": "object",
                        "title": "NetworkOrderSubmitted payload",
                        "required": [
                          "networkRef",
                          "siteId",
                          "localOrderId",
                          "receivedAt",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          },
                          "localOrderId": {
                            "type": "string",
                            "description": "order-management held order id correlated to this network order.",
                            "x-parser-schema-id": "<anonymous-schema-28>"
                          },
                          "receivedAt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the order was received.",
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the order moved to SUBMITTED (same instant as `time`).",
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          }
                        },
                        "x-parser-schema-id": "NetworkOrderSubmittedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-23>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderSubmittedEvent"
              },
              "examples": [
                {
                  "name": "networkOrderSubmitted",
                  "summary": "Network order submitted for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e34",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderSubmitted:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "receivedAt": "2026-09-23T07:59:00Z",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "NetworkOrderAcknowledged",
              "title": "Network order acknowledged (v2)",
              "summary": "The order settled ACKNOWLEDGED: the network's transaction status confirmed the submission.",
              "description": "Raised by the `NetworkOrder` aggregate when `ReconcileSubmittedOrders` settles the order `SUBMITTED -> ACKNOWLEDGED` (ADR 0016), in the same atomic scope as the state save and before the held order is released. It is a settled commitment. `receivedAt` is carried so consumers can compute acknowledgement latency (`at - receivedAt`) without a second lookup — the analytics projection does exactly that. A pending submission raises nothing; a failed one raises `NetworkOrderRejected` with `reason=SUBMISSION_FAILED` and never this event.\n\n**Versioning (breaking change).** Until ADR 0016 this event was published when the order moved to `SUBMITTED`. Because its meaning changed, it is published as a NEW `.v2` type and `:v2` dataschema (fleet CloudEvents standard §4); the v1 type `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged` is no longer published. The payload field set is unchanged. The earlier fact is now `NetworkOrderSubmitted`.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2` — `dataschema`: `urn:warehouse:network-fulfillment:events:NetworkOrderAcknowledged:v2`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "NetworkOrderAcknowledged CloudEvent v2 (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2",
                        "x-parser-schema-id": "<anonymous-schema-32>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:NetworkOrderAcknowledged:v2",
                        "x-parser-schema-id": "<anonymous-schema-33>"
                      },
                      "data": {
                        "type": "object",
                        "title": "NetworkOrderAcknowledged payload (v2)",
                        "description": "Field set identical to the v1 payload; the MEANING changed (ADR 0016): `at` is the instant the order settled ACKNOWLEDGED.",
                        "required": [
                          "networkRef",
                          "siteId",
                          "localOrderId",
                          "receivedAt",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "localOrderId": {
                            "type": "string",
                            "description": "order-management order id correlated to this network order.",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "receivedAt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the order was received.",
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the order settled ACKNOWLEDGED (same instant as `time`).",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          }
                        },
                        "x-parser-schema-id": "NetworkOrderAcknowledgedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-31>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderAcknowledgedEvent"
              },
              "examples": [
                {
                  "name": "networkOrderAcknowledged",
                  "summary": "Network order acknowledged for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2",
                    "subject": "po-1",
                    "time": "2026-09-23T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderAcknowledged:v2",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "receivedAt": "2026-09-23T07:59:00Z",
                      "at": "2026-09-23T08:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "facts of the external-network channel, no consumer by decision (K19)",
              "name": "NetworkOrderRejected",
              "title": "Network order rejected",
              "summary": "We told the network no — or the acknowledgement window closed unanswered.",
              "description": "Raised by the `NetworkOrder` aggregate whenever the order is refused. `reason` distinguishes a catalogue gap, a capacity signal and an operational failure.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected` — `dataschema`: `urn:warehouse:network-fulfillment:events:NetworkOrderRejected:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "NetworkOrderRejected CloudEvent (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected",
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:NetworkOrderRejected:v1",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "data": {
                        "type": "object",
                        "title": "NetworkOrderRejected payload",
                        "required": [
                          "networkRef",
                          "siteId",
                          "reason",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "UNTRANSLATABLE_SKU",
                              "INFEASIBLE_DEADLINE",
                              "ACKNOWLEDGEMENT_DEADLINE_MISSED",
                              "SUBMISSION_FAILED"
                            ],
                            "description": "Why the order was rejected.",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Domain occurred-at (same instant as `time`).",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          }
                        },
                        "x-parser-schema-id": "NetworkOrderRejectedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-39>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderRejectedEvent"
              },
              "examples": [
                {
                  "name": "networkOrderRejected",
                  "summary": "Network order rejected for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderRejected:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "reason": "UNTRANSLATABLE_SKU",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "facts of the external-network channel, no consumer by decision (K19)",
              "name": "NetworkOrderShipmentConfirmed",
              "title": "Network order shipment confirmed",
              "summary": "A shipment was confirmed back to the network, closing the order.",
              "description": "Raised by the `NetworkOrder` aggregate when its shipment is confirmed to the network, by `ConfirmNetworkOrderShipment` (`POST /network-orders/{networkRef}/shipment-confirmation`, ADR 0014). The use case saves the order as `CONFIRMED` and publishes this event in one atomic scope, then submits the confirmation to the network.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed` — `dataschema`: `urn:warehouse:network-fulfillment:events:NetworkOrderShipmentConfirmed:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "NetworkOrderShipmentConfirmed CloudEvent (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed",
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:NetworkOrderShipmentConfirmed:v1",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      },
                      "data": {
                        "type": "object",
                        "title": "NetworkOrderShipmentConfirmed payload",
                        "required": [
                          "networkRef",
                          "siteId",
                          "localOrderId",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "localOrderId": {
                            "type": "string",
                            "description": "order-management order id.",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Domain occurred-at (same instant as `time`).",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          }
                        },
                        "x-parser-schema-id": "NetworkOrderShipmentConfirmedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-46>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderShipmentConfirmedEvent"
              },
              "examples": [
                {
                  "name": "networkOrderShipmentConfirmed",
                  "summary": "Network order shipment confirmed for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f1c2b7e-4c3a-4a1d-9f0b-6c2b8a7d1e33",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:events:NetworkOrderShipmentConfirmed:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "AcknowledgementDeadlineAtRisk",
              "title": "Acknowledgement deadline at risk",
              "summary": "An order's 24h acknowledgement window has closed with no answer — a reported fact, not a state transition.",
              "description": "Raised by `SweepAcknowledgementDeadlines` for every order found still `NEW` past its `acknowledgeBy` instant (ADR 0001 §6). The sweep itself NEVER mutates the aggregate — this event re-fires on every pass for as long as the condition holds true, and a consumer must not treat it as edge-triggered. `RejectOverdueOrders` is the separate use case (its own code path, its own audit trail) that performs the actual rejection, publishing `NetworkOrderRejected` with `reason=ACKNOWLEDGEMENT_DEADLINE_MISSED`.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk` — `dataschema`: `urn:warehouse:network-fulfillment:events:AcknowledgementDeadlineAtRisk:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "AcknowledgementDeadlineAtRisk CloudEvent (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:AcknowledgementDeadlineAtRisk:v1",
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      },
                      "data": {
                        "type": "object",
                        "title": "AcknowledgementDeadlineAtRisk payload",
                        "required": [
                          "networkRef",
                          "siteId",
                          "acknowledgeBy",
                          "at"
                        ],
                        "properties": {
                          "networkRef": {
                            "type": "string",
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "acknowledgeBy": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The SLA instant this order has missed (or is at risk of missing).",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When this sweep pass observed the risk (same instant as `time`). Re-fires on every pass for as long as the order stays unanswered — not edge-triggered.",
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          }
                        },
                        "x-parser-schema-id": "AcknowledgementDeadlineAtRiskData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-53>"
                  }
                ],
                "x-parser-schema-id": "AcknowledgementDeadlineAtRiskEvent"
              },
              "examples": [
                {
                  "name": "acknowledgementDeadlineAtRisk",
                  "summary": "Network order po-1's acknowledgement window has closed unanswered.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
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
              "title": "Orphaned order-management hold cancelled",
              "summary": "A hold order-management made for demand nobody decided was found past the acknowledgement window plus the grace and cancelled — a reported fact, not a state transition.",
              "description": "Raised by `SweepOrphanedHolds` (ADR 0024) once per hold it frees: the order-management order raised for this demand was still held after `acknowledgeBy` plus `ORPHAN_HOLD_GRACE`, the `NetworkOrder` was never committed to (still `NEW`, or `REJECTED` with the cancel never confirmed), and order-management confirmed the hold is gone. The sweep NEVER changes the order's state — `RejectOverdueOrders` owns that and publishes `NetworkOrderRejected` — and it raises this event only when the hold was actually freed: a hold order-management reports as already released (409/422) was not an orphan and raises nothing. The outcome is recorded in the same transaction as the event, so it fires once per hold and is not re-raised on later passes.\n\n`answer` is what order-management said to the cancel: `CANCELLED` (2xx) or `NOT_FOUND` (404, the hold no longer existed — still done). `localOrderId` is the order-management order that was held; it is published here and nowhere else for an order that was never submitted, because `GET /network-orders/{networkRef}` exposes `localOrderId` only from `SUBMITTED` on.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled` — `dataschema`: `urn:warehouse:network-fulfillment:events:OrphanedHoldCancelled:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "network-fulfillment"
                }
              ],
              "payload": {
                "title": "OrphanedHoldCancelled CloudEvent (events)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:events:OrphanedHoldCancelled:v1",
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      },
                      "data": {
                        "type": "object",
                        "title": "OrphanedHoldCancelled payload",
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
                            "description": "Network order reference; also the `subject`.",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "siteId": {
                            "type": "string",
                            "description": "Fulfilling site.",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "localOrderId": {
                            "type": "string",
                            "description": "The order-management order that was held for this demand and is now freed.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "acknowledgeBy": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The order's acknowledgement deadline. The hold was freed after this instant plus `ORPHAN_HOLD_GRACE`.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "answer": {
                            "type": "string",
                            "enum": [
                              "CANCELLED",
                              "NOT_FOUND"
                            ],
                            "description": "What order-management answered to the cancel: `CANCELLED` (2xx) or `NOT_FOUND` (404, the hold no longer existed). A hold already released (409/422) raises no event.",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the sweep freed the hold (same instant as `time`).",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          }
                        },
                        "x-parser-schema-id": "OrphanedHoldCancelledData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-60>"
                  }
                ],
                "x-parser-schema-id": "OrphanedHoldCancelledEvent"
              },
              "examples": [
                {
                  "name": "orphanedHoldCancelled",
                  "summary": "The hold order-management made for network order po-1 was cancelled two hours after its window closed.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
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
                      "acknowledgeBy": "2026-09-22T06:00:00Z",
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
    "warehouse.network-fulfillment.analytics": {
      "description": "The internal analytics topic (the `AnalyticsTopic` constant in\n`internal/adapters/outbound/kafka/analytics_publisher.go`). Carries the\nsame seven occurrences with the same `type` and payload, but a distinct\n`id` per occurrence and dataschema\n`urn:warehouse:network-fulfillment:analytics:<EventName>:v<N>` (v1,\nexcept `NetworkOrderAcknowledged` which is v2). There is\nno `schema_version` field. Consumed by this service's own analytics\nprojector (`internal/adapters/inbound/kafka/analytics_consumer.go`),\nwhich handles `NetworkOrderReceived`, `NetworkOrderSubmitted` (claimed,\nno report effect), `NetworkOrderAcknowledged` v2, the HISTORIC\n`NetworkOrderAcknowledged` v1 still on the topic (unsuffixed type,\npublished before ADR 0016, counted as before so a replay keeps the\nreport numbers) and `NetworkOrderRejected`, ignores other types\n(`NetworkOrderShipmentConfirmed`, `AcknowledgementDeadlineAtRisk` and\n`OrphanedHoldCancelled` today), and dead-letters to\n`warehouse.network-fulfillment.analytics.dlq` anything that is not a\nvalid CloudEvent.\n",
      "subscribe": {
        "operationId": "consumeNetworkFulfillmentAnalytics",
        "summary": "Consume Network Fulfillment analytics events.",
        "description": "Every message is a CloudEvents 1.0 structured-mode event; route on\nthe full `type` attribute.\n",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "NetworkOrderReceivedAnalytics",
              "title": "Network order received (analytics)",
              "summary": "Demand from the external retail network was turned into a NetworkOrder; the 24h acknowledgement clock is running.",
              "description": "Raised by the `NetworkOrder` aggregate the moment network demand is received — whether or not every line could be translated into our SKU vocabulary. `lineCount` is the number of successfully translated lines (0 for demand rejected as untranslatable). Consumed by the analytics projector.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:NetworkOrderReceived:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "NetworkOrderReceived CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived",
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:NetworkOrderReceived:v1",
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-69>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderReceivedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "networkOrderReceivedAnalytics",
                  "summary": "Network order received for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41aa",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderReceived",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:NetworkOrderReceived:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "requiredShipBy": "2026-09-25T08:00:00Z",
                      "acknowledgeBy": "2026-09-24T08:00:00Z",
                      "lineCount": 2,
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "NetworkOrderSubmittedAnalytics",
              "title": "Network order submitted (analytics)",
              "summary": "We told the network yes (the order is SUBMITTED) and a held order exists in order-management; not yet reconciled.",
              "description": "Raised when the order moves to `SUBMITTED`; what `NetworkOrderAcknowledged` v1 used to announce (ADR 0016). Recognised and claimed by the analytics projector, with no effect on the acknowledgement report.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:NetworkOrderSubmitted:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "NetworkOrderSubmitted CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted",
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:NetworkOrderSubmitted:v1",
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[1].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-72>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderSubmittedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "networkOrderSubmittedAnalytics",
                  "summary": "Network order submitted for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41ab",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderSubmitted",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:NetworkOrderSubmitted:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "receivedAt": "2026-09-23T07:59:00Z",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "NetworkOrderAcknowledgedAnalytics",
              "title": "Network order acknowledged (analytics, v2)",
              "summary": "The order settled ACKNOWLEDGED: the network's transaction status confirmed the submission.",
              "description": "Raised when `ReconcileSubmittedOrders` settles the order `SUBMITTED -> ACKNOWLEDGED` (ADR 0016). `receivedAt` is carried so consumers can compute acknowledgement latency (`at - receivedAt`) without a second lookup — the analytics projection does exactly that. Consumed by the analytics projector.\n\n**Versioning.** This is the v2 type; the meaning of the unsuffixed v1 type changed (it was published at `SUBMITTED`, before reconciliation), which the fleet CloudEvents standard treats as breaking. The v1 type `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged` (dataschema `...:analytics:NetworkOrderAcknowledged:v1`) is no longer published but messages already on the topic stay, and the projector still handles them as before (v1 counted once, with the same latency).\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:NetworkOrderAcknowledged:v2`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "NetworkOrderAcknowledged CloudEvent v2 (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2",
                        "x-parser-schema-id": "<anonymous-schema-76>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:NetworkOrderAcknowledged:v2",
                        "x-parser-schema-id": "<anonymous-schema-77>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-75>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderAcknowledgedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "networkOrderAcknowledgedAnalytics",
                  "summary": "Network order acknowledged for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41aa",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderAcknowledged.v2",
                    "subject": "po-1",
                    "time": "2026-09-23T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:NetworkOrderAcknowledged:v2",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "receivedAt": "2026-09-23T07:59:00Z",
                      "at": "2026-09-23T08:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "NetworkOrderRejectedAnalytics",
              "title": "Network order rejected (analytics)",
              "summary": "We told the network no — or the acknowledgement window closed unanswered.",
              "description": "Raised by the `NetworkOrder` aggregate whenever the order is refused. `reason` distinguishes a catalogue gap, a capacity signal and an operational failure. Consumed by the analytics projector.\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:NetworkOrderRejected:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "NetworkOrderRejected CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected",
                        "x-parser-schema-id": "<anonymous-schema-79>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:NetworkOrderRejected:v1",
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-78>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderRejectedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "networkOrderRejectedAnalytics",
                  "summary": "Network order rejected for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41aa",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderRejected",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:NetworkOrderRejected:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "reason": "UNTRANSLATABLE_SKU",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "NetworkOrderShipmentConfirmedAnalytics",
              "title": "Network order shipment confirmed (analytics)",
              "summary": "A shipment was confirmed back to the network, closing the order.",
              "description": "Raised by the `NetworkOrder` aggregate when its shipment is confirmed to the network, by `ConfirmNetworkOrderShipment` (`POST /network-orders/{networkRef}/shipment-confirmation`, ADR 0014). Not used by the analytics projector today (ignored as an unknown type).\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:NetworkOrderShipmentConfirmed:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "NetworkOrderShipmentConfirmed CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed",
                        "x-parser-schema-id": "<anonymous-schema-82>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:NetworkOrderShipmentConfirmed:v1",
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[4].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-81>"
                  }
                ],
                "x-parser-schema-id": "NetworkOrderShipmentConfirmedAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "networkOrderShipmentConfirmedAnalytics",
                  "summary": "Network order shipment confirmed for network order po-1.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3d4a1f60-2b8e-4c17-8a55-0c6f9d2b41aa",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.NetworkOrderShipmentConfirmed",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:NetworkOrderShipmentConfirmed:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "at": "2026-09-23T08:00:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "AcknowledgementDeadlineAtRiskAnalytics",
              "title": "Acknowledgement deadline at risk (analytics)",
              "summary": "An order's 24h acknowledgement window has closed with no answer — a reported fact, not a state transition.",
              "description": "Raised by `SweepAcknowledgementDeadlines` for every order found still `NEW` past its `acknowledgeBy` instant (ADR 0001 §6), and published on the analytics topic like every other event (the composition root's fan-out publishes each event to both topics). Re-fires on every sweep pass while the condition holds — not edge-triggered. Not used by the analytics projector today (ignored as an unknown type).\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:AcknowledgementDeadlineAtRisk:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "AcknowledgementDeadlineAtRisk CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk",
                        "x-parser-schema-id": "<anonymous-schema-85>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:AcknowledgementDeadlineAtRisk:v1",
                        "x-parser-schema-id": "<anonymous-schema-86>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[5].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-84>"
                  }
                ],
                "x-parser-schema-id": "AcknowledgementDeadlineAtRiskAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "acknowledgementDeadlineAtRiskAnalytics",
                  "summary": "Network order po-1's acknowledgement window has closed unanswered.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk",
                    "subject": "po-1",
                    "time": "2026-09-24T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:AcknowledgementDeadlineAtRisk:v1",
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
              "name": "OrphanedHoldCancelledAnalytics",
              "title": "Orphaned order-management hold cancelled (analytics)",
              "summary": "A hold order-management made for demand nobody decided was found past the acknowledgement window plus the grace and cancelled — a reported fact, not a state transition.",
              "description": "Raised by `SweepOrphanedHolds` (ADR 0024) once per hold it frees: the order-management order raised for this demand was still held after `acknowledgeBy` plus `ORPHAN_HOLD_GRACE`, the `NetworkOrder` was never committed to (still `NEW`, or `REJECTED` with the cancel never confirmed), and order-management confirmed the hold is gone. The sweep NEVER changes the order's state — `RejectOverdueOrders` owns that and publishes `NetworkOrderRejected` — and it raises this event only when the hold was actually freed: a hold order-management reports as already released (409/422) was not an orphan and raises nothing. The outcome is recorded in the same transaction as the event, so it fires once per hold and is not re-raised on later passes.\n\n`answer` is what order-management said to the cancel: `CANCELLED` (2xx) or `NOT_FOUND` (404, the hold no longer existed — still done). `localOrderId` is the order-management order that was held; it is published here and nowhere else for an order that was never submitted, because `GET /network-orders/{networkRef}` exposes `localOrderId` only from `SUBMITTED` on.\n\nPublished on the analytics topic like every other event (the composition root's fan-out publishes each event to both topics). Not used by the analytics projector today (ignored as an unknown type).\n\n`type`: `com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled` — `dataschema`: `urn:warehouse:network-fulfillment:analytics:OrphanedHoldCancelled:v1`.\n",
              "contentType": "application/cloudevents+json",
              "headers": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
              "bindings": {
                "kafka": {
                  "key": {
                    "type": "string",
                    "description": "Network order reference (networkRef), identical to `subject`."
                  }
                }
              },
              "tags": [
                {
                  "name": "networkorder"
                },
                {
                  "name": "analytics"
                }
              ],
              "payload": {
                "title": "OrphanedHoldCancelled CloudEvent (analytics)",
                "allOf": [
                  "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled",
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:network-fulfillment:analytics:OrphanedHoldCancelled:v1",
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      },
                      "data": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[6].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-87>"
                  }
                ],
                "x-parser-schema-id": "OrphanedHoldCancelledAnalyticsEvent"
              },
              "examples": [
                {
                  "name": "orphanedHoldCancelledAnalytics",
                  "summary": "The hold order-management made for network order po-1 was cancelled two hours after its window closed.",
                  "headers": {
                    "content-type": "application/cloudevents+json; charset=UTF-8"
                  },
                  "payload": {
                    "specversion": "1.0",
                    "id": "3c4d5e6f-7081-4900-9122-ccddeeff0011",
                    "source": "/warehouse/network-fulfillment",
                    "type": "com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled",
                    "subject": "po-1",
                    "time": "2026-09-23T08:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:network-fulfillment:analytics:OrphanedHoldCancelled:v1",
                    "data": {
                      "networkRef": "po-1",
                      "siteId": "site-1",
                      "localOrderId": "ord-1",
                      "acknowledgeBy": "2026-09-22T06:00:00Z",
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
    "warehouse.process-path-management.events": {
      "description": "process-path-management's integration topic, CONSUMED by this service,\nnot published (the `Topic` constant in\n`internal/adapters/outbound/processpathcache/consumer.go`). The\nprocess-path capability cache replays it from the earliest offset under\na per-process unique group\n(`network-fulfillment-process-path-capability-cache`), started only when\n`CAPABILITY_OFFER_ENABLED=true`. It acts on `ProcessPathCreated`,\n`ProcessPathUpdated`, `ProcessPathDeactivated` and `CPTScheduleChanged`\nand ignores every other type.\n",
      "subscribe": {
        "operationId": "consumeProcessPathEvents",
        "summary": "Keep the local process-path and CPT-schedule capability cache current.",
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "Process path created (consumed from process-path-management)",
              "summary": "A process path was defined.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's `apis/asyncapi.yaml`:\n`source=/warehouse/process-path-management`, type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathCreated`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathCreated, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-90>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-91>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-92>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "x-parser-schema-id": "<anonymous-schema-93>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-94>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-95>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "x-parser-schema-id": "<anonymous-schema-97>"
                  },
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; the producer's payload carries more (required_capabilities, eligibility, intake), ignored here.",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-99>"
                      },
                      "cycle_time_p95": {
                        "type": "string",
                        "description": "Go duration string, e.g. \"24h0m0s\".",
                        "x-parser-schema-id": "<anonymous-schema-100>"
                      },
                      "match_prefix": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-101>"
                      },
                      "destination_location_role": {
                        "type": "string",
                        "enum": [
                          "Drop",
                          "WorkCenter",
                          "Shipping"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-102>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-98>"
                  }
                },
                "x-parser-schema-id": "ProcessPathCreatedEvent"
              }
            },
            {
              "name": "ProcessPathUpdated",
              "title": "Process path updated (consumed from process-path-management)",
              "summary": "A process path definition changed.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's `apis/asyncapi.yaml`:\n`source=/warehouse/process-path-management`, type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathUpdated, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-103>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-104>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-105>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "x-parser-schema-id": "<anonymous-schema-106>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-107>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-108>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-109>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                    "x-parser-schema-id": "<anonymous-schema-110>"
                  },
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; the producer's payload carries more (required_capabilities, eligibility, intake), ignored here.",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "cycle_time_p95": {
                        "type": "string",
                        "description": "Go duration string, e.g. \"24h0m0s\".",
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      },
                      "match_prefix": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      },
                      "destination_location_role": {
                        "type": "string",
                        "enum": [
                          "Drop",
                          "WorkCenter",
                          "Shipping"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-115>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-111>"
                  }
                },
                "x-parser-schema-id": "ProcessPathUpdatedEvent"
              }
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "Process path deactivated (consumed from process-path-management)",
              "summary": "A process path was deactivated.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's `apis/asyncapi.yaml`:\n`source=/warehouse/process-path-management`, type\n`com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's ProcessPathDeactivated, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-116>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-117>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-118>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "x-parser-schema-id": "<anonymous-schema-119>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-120>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-121>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                    "x-parser-schema-id": "<anonymous-schema-123>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "path_id"
                    ],
                    "properties": {
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-124>"
                  }
                },
                "x-parser-schema-id": "ProcessPathDeactivatedEvent"
              }
            },
            {
              "name": "CPTScheduleChanged",
              "title": "CPT schedule changed (consumed from process-path-management)",
              "summary": "The CPT cutoff schedule of a path changed.",
              "description": "CONSUMED, not produced. Pinned by process-path-management's `apis/asyncapi.yaml`:\n`source=/warehouse/process-path-management`, type\n`com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of process-path-management's CPTScheduleChanged, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-126>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-127>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-128>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                    "x-parser-schema-id": "<anonymous-schema-129>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-130>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-131>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-132>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:process-path-management:events:CPTScheduleChanged:v1",
                    "x-parser-schema-id": "<anonymous-schema-133>"
                  },
                  "data": {
                    "type": "object",
                    "description": "A full snapshot of the site's cutoff schedule, not a diff; the cache keeps path id -> next cutoff.",
                    "required": [
                      "site_id",
                      "timezone",
                      "cutoffs"
                    ],
                    "properties": {
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-135>"
                      },
                      "timezone": {
                        "type": "string",
                        "description": "IANA zone.",
                        "x-parser-schema-id": "<anonymous-schema-136>"
                      },
                      "cutoffs": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "required": [
                            "cpt_id",
                            "local_time",
                            "days_of_week",
                            "ship_method",
                            "eligible_path_ids"
                          ],
                          "properties": {
                            "cpt_id": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-139>"
                            },
                            "local_time": {
                              "type": "string",
                              "description": "Recurring daily cutoff, HH:MM.",
                              "x-parser-schema-id": "<anonymous-schema-140>"
                            },
                            "days_of_week": {
                              "type": "array",
                              "items": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-142>"
                              },
                              "x-parser-schema-id": "<anonymous-schema-141>"
                            },
                            "ship_method": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-143>"
                            },
                            "eligible_path_ids": {
                              "type": "array",
                              "items": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-145>"
                              },
                              "x-parser-schema-id": "<anonymous-schema-144>"
                            }
                          },
                          "x-parser-schema-id": "<anonymous-schema-138>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-134>"
                  }
                },
                "x-parser-schema-id": "CPTScheduleChangedEvent"
              }
            }
          ]
        }
      }
    },
    "warehouse.work-planning.events": {
      "description": "wes-work-planning's integration topic, CONSUMED by this service, not\npublished (the `Topic` constant in\n`internal/adapters/outbound/pathcapacitycache/consumer.go`). The path\ncapacity cache replays it under a per-process unique group, started only\nwhen `CAPABILITY_OFFER_ENABLED=true`, and acts only on\n`PathCapacityChanged`.\n",
      "subscribe": {
        "operationId": "consumeWorkPlanningEvents",
        "summary": "Keep the local remaining-admission-capacity read model current.",
        "message": {
          "name": "PathCapacityChanged",
          "title": "Path capacity changed (consumed from wes-work-planning)",
          "summary": "The remaining admission capacity of a process path changed.",
          "description": "CONSUMED, not produced. Pinned by wes-work-planning's `apis/asyncapi.yaml`:\n`source=/warehouse/wes-work-planning`, type\n`com.warehouse.wes.work-planning.workpool.PathCapacityChanged`.\n",
          "contentType": "application/cloudevents+json",
          "payload": {
            "type": "object",
            "description": "CloudEvents 1.0 envelope of wes-work-planning's PathCapacityChanged, the integration payload, as\nconsumed here.\n",
            "required": [
              "specversion",
              "id",
              "source",
              "type",
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
                "x-parser-schema-id": "<anonymous-schema-146>"
              },
              "id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-147>"
              },
              "source": {
                "type": "string",
                "enum": [
                  "/warehouse/wes-work-planning"
                ],
                "x-parser-schema-id": "<anonymous-schema-148>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wes.work-planning.workpool.PathCapacityChanged",
                "x-parser-schema-id": "<anonymous-schema-149>"
              },
              "subject": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-150>"
              },
              "time": {
                "type": "string",
                "format": "date-time",
                "x-parser-schema-id": "<anonymous-schema-151>"
              },
              "datacontenttype": {
                "type": "string",
                "enum": [
                  "application/json"
                ],
                "x-parser-schema-id": "<anonymous-schema-152>"
              },
              "dataschema": {
                "type": "string",
                "const": "urn:warehouse:wes-work-planning:events:PathCapacityChanged:v1",
                "x-parser-schema-id": "<anonymous-schema-153>"
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
                    "x-parser-schema-id": "<anonymous-schema-155>"
                  },
                  "cutoff_at": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  },
                  "remaining_units": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-157>"
                  },
                  "known": {
                    "type": "boolean",
                    "x-parser-schema-id": "<anonymous-schema-158>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-154>"
              }
            },
            "x-parser-schema-id": "PathCapacityChangedEvent"
          }
        }
      }
    },
    "warehouse.inbound-receiving.events": {
      "description": "inbound-receiving's integration topic, CONSUMED by this service, not\npublished (the inbound loop of ADR 0028: `TypeReceiptCartonReceived`,\n`TypeCartonDiscrepancyRaised`, `TypeReceiptClosed` in\n`internal/adapters/inbound/kafka/receipt_consumer.go`). The consumer\nbooks the vendor's seller-shipment cartons onto inbound-receiving's ASNs\nand reports the receipts back to the network, under the stable group\n`INBOUND_RECEIPT_CONSUMER_GROUP` (set in warehouse-infra develop as\n`network-fulfillment-inbound-receiving`).\n",
      "subscribe": {
        "operationId": "consumeInboundReceiptEvents",
        "summary": "Apply the receipt handover of the inbound loop (ADR 0028).",
        "message": {
          "oneOf": [
            {
              "name": "ReceiptCartonReceived",
              "title": "Receipt carton received (consumed from inbound-receiving)",
              "summary": "One carton of a receipt was received (identity-only handover to this service; the carton contents stay in inbound-receiving).",
              "description": "CONSUMED, not produced. Pinned by inbound-receiving's `apis/asyncapi.yaml`:\n`source=/warehouse/inbound-receiving`, type\n`com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of inbound-receiving's ReceiptCartonReceived, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-159>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-160>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/inbound-receiving"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-161>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived",
                    "x-parser-schema-id": "<anonymous-schema-162>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-163>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-164>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-165>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:inbound-receiving:events:ReceiptCartonReceived:v1",
                    "x-parser-schema-id": "<anonymous-schema-166>"
                  },
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads (receipt, ASN, carton identity); the full contents stay with inbound-receiving.",
                    "required": [
                      "receipt_id",
                      "asn_number",
                      "sealed",
                      "lpn",
                      "contents",
                      "received_at"
                    ],
                    "properties": {
                      "receipt_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-168>"
                      },
                      "asn_number": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-169>"
                      },
                      "sscc": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-170>"
                      },
                      "lpn": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-171>"
                      },
                      "received_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-172>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-167>"
                  }
                },
                "x-parser-schema-id": "ReceiptCartonReceivedEvent"
              }
            },
            {
              "name": "CartonDiscrepancyRaised",
              "title": "Carton discrepancy raised (consumed from inbound-receiving)",
              "summary": "A carton-level finding was raised during receipt.",
              "description": "CONSUMED, not produced. Pinned by inbound-receiving's `apis/asyncapi.yaml`:\n`source=/warehouse/inbound-receiving`, type\n`com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of inbound-receiving's CartonDiscrepancyRaised, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-173>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-174>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/inbound-receiving"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-175>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised",
                    "x-parser-schema-id": "<anonymous-schema-176>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-177>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-178>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-179>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:inbound-receiving:events:CartonDiscrepancyRaised:v1",
                    "x-parser-schema-id": "<anonymous-schema-180>"
                  },
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
                        "x-parser-schema-id": "<anonymous-schema-182>"
                      },
                      "sscc": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-183>"
                      },
                      "kind": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-184>"
                      },
                      "expected": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-185>"
                      },
                      "actual": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-186>"
                      },
                      "at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-187>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-181>"
                  }
                },
                "x-parser-schema-id": "CartonDiscrepancyRaisedEvent"
              }
            },
            {
              "name": "ReceiptClosed",
              "title": "Receipt closed (consumed from inbound-receiving)",
              "summary": "A receipt was closed.",
              "description": "CONSUMED, not produced. Pinned by inbound-receiving's `apis/asyncapi.yaml`:\n`source=/warehouse/inbound-receiving`, type\n`com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed`.\n",
              "contentType": "application/cloudevents+json",
              "payload": {
                "type": "object",
                "description": "CloudEvents 1.0 envelope of inbound-receiving's ReceiptClosed, the integration payload, as\nconsumed here.\n",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
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
                    "x-parser-schema-id": "<anonymous-schema-188>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-189>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "/warehouse/inbound-receiving"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-190>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed",
                    "x-parser-schema-id": "<anonymous-schema-191>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-192>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-193>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "enum": [
                      "application/json"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-194>"
                  },
                  "dataschema": {
                    "type": "string",
                    "const": "urn:warehouse:inbound-receiving:events:ReceiptClosed:v1",
                    "x-parser-schema-id": "<anonymous-schema-195>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "receipt_id",
                      "asn_number",
                      "closed_at",
                      "discrepancies"
                    ],
                    "properties": {
                      "receipt_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-197>"
                      },
                      "asn_number": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-198>"
                      },
                      "closed_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-199>"
                      },
                      "discrepancies": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "x-parser-schema-id": "<anonymous-schema-201>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-200>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-196>"
                  }
                },
                "x-parser-schema-id": "ReceiptClosedEvent"
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "NetworkOrderReceived": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0]",
      "NetworkOrderSubmitted": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[1]",
      "NetworkOrderAcknowledged": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[2]",
      "NetworkOrderRejected": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[3]",
      "NetworkOrderShipmentConfirmed": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[4]",
      "AcknowledgementDeadlineAtRisk": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[5]",
      "OrphanedHoldCancelled": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[6]",
      "NetworkOrderReceivedAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[0]",
      "NetworkOrderSubmittedAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[1]",
      "NetworkOrderAcknowledgedAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[2]",
      "NetworkOrderRejectedAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[3]",
      "NetworkOrderShipmentConfirmedAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[4]",
      "AcknowledgementDeadlineAtRiskAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[5]",
      "OrphanedHoldCancelledAnalytics": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[6]",
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[2]",
      "CPTScheduleChanged": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[3]",
      "PathCapacityChanged": "$ref:$.channels.warehouse.work-planning.events.subscribe.message",
      "ReceiptCartonReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0]",
      "CartonDiscrepancyRaised": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1]",
      "ReceiptClosed": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2]"
    },
    "schemas": {
      "KafkaHeaders": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].headers",
      "CloudEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "NetworkOrderReceivedData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data",
      "NetworkOrderSubmittedData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[1].payload.allOf[1].properties.data",
      "NetworkOrderAcknowledgedData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data",
      "NetworkOrderRejectedData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[3].payload.allOf[1].properties.data",
      "NetworkOrderShipmentConfirmedData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[4].payload.allOf[1].properties.data",
      "AcknowledgementDeadlineAtRiskData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[5].payload.allOf[1].properties.data",
      "OrphanedHoldCancelledData": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[6].payload.allOf[1].properties.data",
      "NetworkOrderReceivedEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[0].payload",
      "NetworkOrderSubmittedEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[1].payload",
      "NetworkOrderAcknowledgedEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[2].payload",
      "NetworkOrderRejectedEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[3].payload",
      "NetworkOrderShipmentConfirmedEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[4].payload",
      "AcknowledgementDeadlineAtRiskEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[5].payload",
      "OrphanedHoldCancelledEvent": "$ref:$.channels.warehouse.network-fulfillment.events.subscribe.message.oneOf[6].payload",
      "NetworkOrderReceivedAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[0].payload",
      "NetworkOrderSubmittedAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[1].payload",
      "NetworkOrderAcknowledgedAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[2].payload",
      "NetworkOrderRejectedAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[3].payload",
      "NetworkOrderShipmentConfirmedAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[4].payload",
      "AcknowledgementDeadlineAtRiskAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[5].payload",
      "OrphanedHoldCancelledAnalyticsEvent": "$ref:$.channels.warehouse.network-fulfillment.analytics.subscribe.message.oneOf[6].payload",
      "ProcessPathCreatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[0].payload",
      "ProcessPathUpdatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[1].payload",
      "ProcessPathDeactivatedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[2].payload",
      "CPTScheduleChangedEvent": "$ref:$.channels.warehouse.process-path-management.events.subscribe.message.oneOf[3].payload",
      "PathCapacityChangedEvent": "$ref:$.channels.warehouse.work-planning.events.subscribe.message.payload",
      "ReceiptCartonReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload",
      "CartonDiscrepancyRaisedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1].payload",
      "ReceiptClosedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2].payload"
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
  