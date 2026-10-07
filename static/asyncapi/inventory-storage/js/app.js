
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Inventory & Storage Domain Events",
    "version": "1.0.0",
    "description": "Domain-event catalog for the **inventory-storage** bounded context, the WMS-tier authoritative record of what is held where, and what portion of it is usable. This context implements Amazon-style chaotic (random) stow: there is no fixed product location — an inbound item may be stowed into any free bin, and this service records the exact bin it landed in. It supplies \"stock reality\" to the Work Planning bounded context (wes-work-planning) and makes allocation a *revocable* reservation, so a failed physical pick never strands an order.\n\n**Envelope.** Every message on this channel is a CloudEvents 1.0 *structured-mode* JSON document with content type `application/cloudevents+json`. The CloudEvents context attributes carry routing and identity (`specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype`); the business payload lives entirely under `data`. `source` is always `/warehouse/inventory-storage`, and `subject` is the id of the aggregate instance the event is about (a reservation id, a stock unit id, or a bin id).\n\n**The `type` attribute** follows the platform-wide reverse-DNS convention `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>` — all lowercase except the final PascalCase event name. For this context the subdomain is `wms` (Warehouse Management System, a core subdomain) and the bounded context is `inventory-storage`, so for example a stow produces `com.warehouse.wms.inventory-storage.stock.ItemStowed` and a revoked allocation produces `com.warehouse.wms.inventory-storage.reservation.ReservationRevoked`.\n\n**Aggregates and entity groupings.** Four aggregates raise every event documented here. The **StockUnit** aggregate (entity segment `stock`) raises `StockReceived`, `ItemStowed`, `LocationRecorded` and `ItemUnlocated`. The **Reservation** aggregate (entity segment `reservation`) raises `StockReserved`, `ReservationExpired`, `ReservationRevoked` and `StockPicked` — `StockPicked` is grouped with the reservation because it is emitted by ConfirmPick when a reservation is consumed, and reservation id is the only identity it carries. The **Bin/Location** aggregate (entity segment `bin`) raises `CycleCountCompleted` and `DiscrepancyDetected`. The **ProductClassification** aggregate (entity segment `product`) raises `ProductClassified`.\n\n**What reaches Kafka.** This document is the complete domain-event catalog for the bounded context. Two topics carry a subset of it: `warehouse.inventory.events` (the integration contract — `StockReserved`, `ReservationRevoked`, the two transfer replies, and `ProductClassified` (SKU master data, ADR 0031), from `internal/adapters/outbound/kafka/publisher.go`) and `warehouse.inventory.analytics` (the analytics data product — every message below except `LocationRecorded`, from `internal/adapters/outbound/kafka/analytics_publisher.go`). Each message says which topics it reaches. `LocationRecorded` is in-process only (no consumer; decided 2026-10-06).\n\n**CloudEvents is mandatory (ADR-0024).** Every message on both topics is exactly the CloudEvents 1.0 structured-mode event documented here — all of `specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype` and `dataschema` are required — and every Kafka message carries the header `content-type: application/cloudevents+json; charset=UTF-8`. The same `type` names an occurrence on both topics; `dataschema` (`urn:warehouse:inventory-storage:<events|analytics>:<EventName>:v1`) names the payload shape. Each schema's `data` is the exact wire payload; `StockReserved` and `ReservationRevoked`, which reach both topics, give one `data` shape per `dataschema`. There is no other envelope.\n",
    "contact": {
      "name": "Warehouse Systems Platform Team",
      "url": "https://github.com/claudioed/inventory-storage",
      "email": "claudioed.oliveira@gmail.com"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  "tags": [
    {
      "name": "inventory-storage",
      "description": "The inventory-storage bounded context (wms subdomain) — the authoritative record of what stock is held in which bin, and how much of it is usable.\n"
    },
    {
      "name": "stock",
      "description": "Events raised by the StockUnit aggregate: a quantity of a SKU at a specific bin, its receipt, its stow, and its loss.\n"
    },
    {
      "name": "reservation",
      "description": "Events raised by the Reservation aggregate: the revocable binding of a quantity to demand, its timeout, its revocation, and its consumption.\n"
    },
    {
      "name": "bin",
      "description": "Events raised by the Bin/Location aggregate: cycle counts verifying a bin's contents and the discrepancies they reveal.\n"
    },
    {
      "name": "product",
      "description": "Events raised by the ProductClassification aggregate: SKU-level handling master data (hazmat, fragile, temperature, ...) this service owns.\n"
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "The shared warehouse-systems Kafka broker. Locally this is the broker started by `~/warehouse-systems/docker-compose.kafka.yml`, addressed via the `KAFKA_BROKERS` environment variable (default `localhost:9092`). The Kafka publisher is selected with `EVENT_PUBLISHER=kafka`; the default `log` publisher writes events to stdout instead.\n"
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.inventory.events": {
      "description": "The outbound integration topic for this bounded context (the `Topic` constant in `internal/adapters/outbound/kafka/publisher.go`). Reaching it: `StockReserved` and `ReservationRevoked` (keyed by reservation id), the two transfer replies, and `ProductClassified` (keyed by SKU, ADR 0031). The primary downstream consumer is wes-work-planning, which dispatches on their full `type` strings and projects them into its `UsableInventoryObserved` read model, keyed by SKU.\n",
      "subscribe": {
        "operationId": "consumeInventoryStorageEvents",
        "summary": "Consume inventory-storage domain events.",
        "description": "Subscribe to the domain events raised by the inventory-storage bounded context. Messages are CloudEvents 1.0 structured-mode JSON; discriminate on the FULL `type` context attribute, which is fixed per message via a const in the schemas below, and dedupe on `id`. Consumers must ignore unknown `type` values (forward compatibility).\n",
        "tags": [
          {
            "name": "inventory-storage",
            "description": "Events emitted by the inventory-storage bounded context."
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "StockReserved",
              "title": "Stock Reserved",
              "summary": "A quantity was revocably bound to demand.",
              "description": "Raised by the ReserveStock use case when a reservation is successfully created against *usable* inventory (on-hand minus active reservations minus held/unlocated stock). The binding is revocable and carries a timeout, so a physical failure downstream never strands the demand.\n\n**Published to both topics.** On `warehouse.inventory.events` (dataschema `urn:warehouse:inventory-storage:events:StockReserved:v1`) the `data` payload is the adapter's `reservationData` shape — `sku`, `quantity`, `demand_ref` — and the reservation id is the CloudEvents `subject` and the Kafka key. wes-work-planning consumes this exact `type` to update its `UsableInventoryObserved` read model by SKU. On `warehouse.inventory.analytics` (dataschema `...:analytics:StockReserved:v1`, Kafka key = reservation id — ADR 0021) `data` is `{sku, reservation_id, quantity}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Raised by the Reservation aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a StockReserved domain event, on both topics; `dataschema` selects the `data` shape.\n",
                "allOf": [
                  {
                    "type": "object",
                    "description": "The CloudEvents 1.0 context attributes shared by every message this bounded context emits, in structured-mode JSON. Each concrete event schema composes this with `allOf` and pins `type` to a single value.\n",
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
                        "description": "CloudEvents specification version. Always \"1.0\".",
                        "enum": [
                          "1.0"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-1>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "Unique identifier for this event occurrence, a UUID v4. Together with `source` it uniquely identifies the event, which is what consumers deduplicate on.\n",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "description": "The context that emitted the event. Always `/warehouse/inventory-storage` for this service.\n",
                        "enum": [
                          "/warehouse/inventory-storage"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "Reverse-DNS event type, of the form `com.warehouse.wms.inventory-storage.<entity>.<EventName>`. Pinned to a single value by each concrete event schema.\n",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "The id of the aggregate instance this event is about — a reservation id, a StockUnit id, a bin id, or a SKU, depending on the event. Never empty.\n",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "RFC 3339 timestamp of when the event occurred in the domain, taken from the injected Clock port, not from wall-clock time at publish.\n",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "description": "Media type of the `data` member. Always application/json.",
                        "enum": [
                          "application/json"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "Absolute URI naming the payload shape and version: `urn:warehouse:inventory-storage:<events|analytics>:<EventName>:v<N>`. Pinned per message by each concrete event schema (the `events` variant for StockReserved/ReservationRevoked, `analytics` for the rest; StockReserved and ReservationRevoked also appear on the analytics topic with the `analytics` variant).\n",
                        "pattern": "^urn:warehouse:inventory-storage:(events|analytics):[A-Za-z]+:v[0-9]+$",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The event payload. Shape is fixed by `dataschema`.",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventBase"
                  },
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for StockReserved.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.StockReserved",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:StockReserved:v1 on the integration topic, ...:analytics:StockReserved:v1 on the analytics topic.",
                        "pattern": "^urn:warehouse:inventory-storage:(events|analytics):StockReserved:v1$",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "description": "One shape per dataschema: the integration payload on warehouse.inventory.events, the analytics payload on warehouse.inventory.analytics.\n",
                        "oneOf": [
                          {
                            "type": "object",
                            "description": "Business payload for StockReserved, matching the adapter's `reservationData` struct field-for-field.\n",
                            "required": [
                              "sku",
                              "quantity",
                              "demand_ref"
                            ],
                            "properties": {
                              "sku": {
                                "type": "string",
                                "description": "The stock keeping unit the quantity was reserved against.",
                                "x-parser-schema-id": "<anonymous-schema-15>"
                              },
                              "quantity": {
                                "type": "integer",
                                "minimum": 1,
                                "description": "Quantity bound to the demand. Never exceeds usable inventory for the SKU at reserve time.\n",
                                "x-parser-schema-id": "<anonymous-schema-16>"
                              },
                              "demand_ref": {
                                "type": "string",
                                "description": "Opaque reference to the demand this reservation serves, supplied by the caller — typically an order or shipment id.\n",
                                "x-parser-schema-id": "<anonymous-schema-17>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          {
                            "type": "object",
                            "title": "analytics",
                            "description": "Analytics payload (dataschema ...:analytics:StockReserved:v1).",
                            "required": [
                              "sku",
                              "reservation_id",
                              "quantity"
                            ],
                            "properties": {
                              "sku": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-19>"
                              },
                              "reservation_id": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-20>"
                              },
                              "quantity": {
                                "type": "integer",
                                "minimum": 1,
                                "x-parser-schema-id": "<anonymous-schema-21>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-10>"
                  }
                ],
                "x-parser-schema-id": "StockReservedEvent"
              },
              "examples": [
                {
                  "name": "reservedForOrder42",
                  "summary": "Five units of SKU-1 reserved for demand reference order-42.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1f7a4c30-9b2d-4e85-a6c1-7d3f0b5e8a94",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.StockReserved",
                    "subject": "res-1",
                    "time": "2026-08-21T22:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:StockReserved:v1",
                    "data": {
                      "sku": "SKU-1",
                      "quantity": 5,
                      "demand_ref": "order-42"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReservationRevoked",
              "title": "Reservation Revoked",
              "summary": "A reservation was cancelled and its quantity returned to usable.",
              "description": "Raised by the RevokeReservation use case. Revocation is the mechanism that keeps a physical failure — a blocked pod, a lost tote, a chute jam, a short pick — from stranding an order: the quantity goes back to usable and the demand can be re-allocated against a different holding.\n\n**Published to both topics.** On `warehouse.inventory.events` (dataschema `urn:warehouse:inventory-storage:events:ReservationRevoked:v1`) the domain event carries only the reservation id, so the adapter enriches it through `ports.ReservationRepo` and emits the same `sku` / `quantity` / `demand_ref` shape as StockReserved; if the lookup finds nothing the publish fails rather than emitting a partial payload. The reservation id is the `subject` and the Kafka key. wes-work-planning consumes this exact `type`. On `warehouse.inventory.analytics` `data` is `{reservation_id, sku}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Raised by the Reservation aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a ReservationRevoked domain event. The `data` member is enriched by the outbound Kafka adapter, which looks the reservation up through ports.ReservationRepo because the domain event carries only the reservation id.\n",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for ReservationRevoked.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.ReservationRevoked",
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:ReservationRevoked:v1 on the integration topic, ...:analytics:ReservationRevoked:v1 on the analytics topic.",
                        "pattern": "^urn:warehouse:inventory-storage:(events|analytics):ReservationRevoked:v1$",
                        "x-parser-schema-id": "<anonymous-schema-24>"
                      },
                      "data": {
                        "description": "One shape per dataschema: the integration payload on warehouse.inventory.events, the analytics payload on warehouse.inventory.analytics.\n",
                        "oneOf": [
                          {
                            "type": "object",
                            "description": "Business payload for ReservationRevoked, identical in shape to StockReserved so downstream projections can apply both with one handler.\n",
                            "required": [
                              "sku",
                              "quantity",
                              "demand_ref"
                            ],
                            "properties": {
                              "sku": {
                                "type": "string",
                                "description": "The stock keeping unit whose quantity returns to usable.",
                                "x-parser-schema-id": "<anonymous-schema-27>"
                              },
                              "quantity": {
                                "type": "integer",
                                "minimum": 1,
                                "description": "Quantity released back into usable inventory.",
                                "x-parser-schema-id": "<anonymous-schema-28>"
                              },
                              "demand_ref": {
                                "type": "string",
                                "description": "The demand reference the revoked reservation was serving, so the consumer can re-allocate it elsewhere.\n",
                                "x-parser-schema-id": "<anonymous-schema-29>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          {
                            "type": "object",
                            "title": "analytics",
                            "description": "Analytics payload (dataschema ...:analytics:ReservationRevoked:v1).",
                            "required": [
                              "reservation_id",
                              "sku"
                            ],
                            "properties": {
                              "reservation_id": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-31>"
                              },
                              "sku": {
                                "type": "string",
                                "description": "Enriched via ports.ReservationRepo; empty if not found.",
                                "x-parser-schema-id": "<anonymous-schema-32>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-30>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-25>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-22>"
                  }
                ],
                "x-parser-schema-id": "ReservationRevokedEvent"
              },
              "examples": [
                {
                  "name": "revokedAfterShortPick",
                  "summary": "Reservation res-1 revoked, returning five units of SKU-1 to usable.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4b9e2f61-7c3a-4d08-85e2-1a6f9c0d3b72",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.ReservationRevoked",
                    "subject": "res-1",
                    "time": "2026-08-21T22:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:ReservationRevoked:v1",
                    "data": {
                      "sku": "SKU-1",
                      "quantity": 5,
                      "demand_ref": "order-42"
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferStockAllocated",
              "title": "Transfer Stock Allocated",
              "summary": "Origin-site stock was reserved for a network transfer line.",
              "description": "Raised by the AllocateTransferStock use case when a transfer allocation command from network-inventory-planning (com.warehouse.wes.network-inventory-planning.transfer.TransferAllocationRequested on warehouse.network-inventory-planning.events) was satisfied: usable stock in the ORIGIN SITE's custody was drawn and a revocable Reservation now holds it, correlated to the transfer line via the transfer_allocations ledger (one row per transfer_line_id, DB-unique — replays return this same event's original outcome without re-deciding).\n\n**Integration topic only** (no analytics variant: the Inventory Flow & Accuracy projection has no transfer dimension). Kafka key and CloudEvents `subject` are the reservation id, so a transfer's replies stay per-reservation ordered (ADR 0021).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Raised on the Reservation aggregate's stock-holding path."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a TransferStockAllocated domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for TransferStockAllocated.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated",
                        "x-parser-schema-id": "<anonymous-schema-34>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:TransferStockAllocated:v1",
                        "pattern": "^urn:warehouse:inventory-storage:events:TransferStockAllocated:v1$",
                        "x-parser-schema-id": "<anonymous-schema-35>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for TransferStockAllocated.",
                        "required": [
                          "transfer_id",
                          "transfer_line_id",
                          "origin_site_id",
                          "reservation_id",
                          "sku",
                          "quantity",
                          "allocations",
                          "expires_at"
                        ],
                        "properties": {
                          "transfer_id": {
                            "type": "string",
                            "description": "The planning context's transfer (saga) id.",
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          },
                          "transfer_line_id": {
                            "type": "string",
                            "description": "The transfer line this allocation decides; DB-unique in the ledger.",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "origin_site_id": {
                            "type": "string",
                            "description": "The site whose custody donated the stock.",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "reservation_id": {
                            "type": "string",
                            "description": "The Reservation aggregate now holding the stock.",
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit allocated.",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Total quantity held for the transfer line.",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "allocations": {
                            "type": "array",
                            "minItems": 1,
                            "description": "Per-stock-unit draws with pick locations.",
                            "items": {
                              "type": "object",
                              "required": [
                                "stock_unit_id",
                                "bin_id",
                                "quantity"
                              ],
                              "properties": {
                                "stock_unit_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-45>"
                                },
                                "bin_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-46>"
                                },
                                "quantity": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-47>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-44>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "expires_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the holding reservation times out (revocable).",
                            "x-parser-schema-id": "<anonymous-schema-48>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-36>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  }
                ],
                "x-parser-schema-id": "TransferStockAllocatedEvent"
              },
              "examples": [
                {
                  "name": "allocatedForTransferLine",
                  "summary": "Six units of SKU-T1 reserved at SITE-A for transfer line tl-77-1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f9d2b66-8c41-4e07-b2a9-6d5c1e0f4b21",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated",
                    "subject": "res-tr-1",
                    "time": "2026-10-06T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:TransferStockAllocated:v1",
                    "data": {
                      "transfer_id": "tr-77",
                      "transfer_line_id": "tl-77-1",
                      "origin_site_id": "SITE-A",
                      "reservation_id": "res-tr-1",
                      "sku": "SKU-T1",
                      "quantity": 6,
                      "allocations": [
                        {
                          "stock_unit_id": "su-1",
                          "bin_id": "BIN-1",
                          "quantity": 4
                        },
                        {
                          "stock_unit_id": "su-2",
                          "bin_id": "BIN-2",
                          "quantity": 2
                        }
                      ],
                      "expires_at": "2026-10-06T12:30:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferStockAllocationRejected",
              "title": "Transfer Stock Allocation Rejected",
              "summary": "No stock was held for a network transfer line; the closed reason says why.",
              "description": "Raised by the AllocateTransferStock use case when a transfer allocation command could not be satisfied. `reason` is a CLOSED set: ORIGIN_SITE_UNKNOWN (no usable stock in the requested origin site's custody — including legacy site-less stock, which is never transfer-allocatable), INSUFFICIENT_USABLE (the origin holds the SKU but not enough usable quantity), IDEMPOTENCY_CONFLICT (the transfer_line_id was replayed with a DIFFERENT command payload; the original ledger decision stands and this reply tells the planner so).\n\n**Integration topic only** (no analytics variant). Kafka key and CloudEvents `subject` are the transfer_line_id — a rejection has no reservation, so the line is the aggregate the reply is about.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Reply on the transfer allocation command path."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a TransferStockAllocationRejected domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for TransferStockAllocationRejected.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected",
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:TransferStockAllocationRejected:v1",
                        "pattern": "^urn:warehouse:inventory-storage:events:TransferStockAllocationRejected:v1$",
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for TransferStockAllocationRejected.",
                        "required": [
                          "transfer_id",
                          "transfer_line_id",
                          "origin_site_id",
                          "sku",
                          "requested_quantity",
                          "reason"
                        ],
                        "properties": {
                          "transfer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          },
                          "transfer_line_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "origin_site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "requested_quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "reason": {
                            "type": "string",
                            "enum": [
                              "ORIGIN_SITE_UNKNOWN",
                              "INSUFFICIENT_USABLE",
                              "IDEMPOTENCY_CONFLICT"
                            ],
                            "description": "Closed rejection reason set. ORIGIN_SITE_UNKNOWN: no usable stock in the origin site's custody (including legacy site-less stock). INSUFFICIENT_USABLE: origin holds the SKU but not enough usable quantity. IDEMPOTENCY_CONFLICT: the line id was replayed with a different payload; the original decision stands.\n",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-52>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-49>"
                  }
                ],
                "x-parser-schema-id": "TransferStockAllocationRejectedEvent"
              },
              "examples": [
                {
                  "name": "rejectedInsufficientUsable",
                  "summary": "SITE-B could not cover nine units of SKU-T2.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5a1e7c93-d4f8-4b60-c3d7-7e9b2f6a8c15",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected",
                    "subject": "tl-77-2",
                    "time": "2026-10-06T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:TransferStockAllocationRejected:v1",
                    "data": {
                      "transfer_id": "tr-77",
                      "transfer_line_id": "tl-77-2",
                      "origin_site_id": "SITE-B",
                      "sku": "SKU-T2",
                      "requested_quantity": 9,
                      "reason": "INSUFFICIENT_USABLE"
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductClassified",
              "title": "Product Classified",
              "summary": "A SKU's handling classification (master data) was registered or replaced.",
              "description": "Raised by the ClassifyProduct use case when a SKU's ProductClassification is registered or replaced (ADR 0009). The classification is SKU-level master data this service owns; publishing it lets siblings keep a local copy instead of polling `GET /products/{sku}/classification` (ADR 0031, which supersedes only the \"in-process only\" clause of ADR 0024 for this event).\n\n**Published to both topics**, through the transactional outbox in the same transaction as the classification save. CloudEvents `subject` and the Kafka key are the SKU, so reclassifications of one SKU stay ordered on one partition. `data` is `{sku, handling_tags, temperature_class?, dot_hazard_class?}` on both topics (dataschema `urn:warehouse:inventory-storage:events:ProductClassified:v1` on `warehouse.inventory.events`, `...:analytics:ProductClassified:v1` on `warehouse.inventory.analytics`). It is a **full-state replacement**: overwrite your local row; an absent optional field means \"none\". `handling_tags` is in the aggregate's stable enum order. No PII. This service's own analytics projector ignores it.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product",
                  "description": "Raised by the ProductClassification aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a ProductClassified domain event, on both topics; `dataschema` selects the topic variant, the `data` shape is the same on both.\n",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for ProductClassified.",
                        "const": "com.warehouse.wms.inventory-storage.product.ProductClassified",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:ProductClassified:v1 on the integration topic, ...:analytics:ProductClassified:v1 on the analytics topic.",
                        "pattern": "^urn:warehouse:inventory-storage:(events|analytics):ProductClassified:v1$",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Full-state replacement of the SKU's classification. Optional fields are omitted when unset.\n",
                        "required": [
                          "sku",
                          "handling_tags"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The classified SKU (also the CloudEvents subject and Kafka key).",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "handling_tags": {
                            "type": "array",
                            "minItems": 1,
                            "description": "Non-empty, duplicate-free set of handling tags, in the aggregate's stable enum order.",
                            "items": {
                              "type": "string",
                              "enum": [
                                "Hazmat",
                                "Fragile",
                                "TemperatureSensitive",
                                "Oversized",
                                "HighValue"
                              ],
                              "x-parser-schema-id": "<anonymous-schema-65>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "temperature_class": {
                            "type": "string",
                            "enum": [
                              "Ambient",
                              "Chilled",
                              "Frozen"
                            ],
                            "description": "Present if and only if handling_tags includes TemperatureSensitive.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "dot_hazard_class": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 9,
                            "description": "Top-level US DOT hazard class; present only for a Hazmat classification with one recorded (ADR 0010).",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  }
                ],
                "x-parser-schema-id": "ProductClassifiedEvent"
              },
              "examples": [
                {
                  "name": "hazmatFrozenSku",
                  "summary": "SKU-9 classified as Hazmat + TemperatureSensitive (Frozen), DOT class 3.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e2f5d18-0a9c-4b34-9d61-4c8a3e7b1f05",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.product.ProductClassified",
                    "subject": "SKU-9",
                    "time": "2026-10-06T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:ProductClassified:v1",
                    "data": {
                      "sku": "SKU-9",
                      "handling_tags": [
                        "Hazmat",
                        "TemperatureSensitive"
                      ],
                      "temperature_class": "Frozen",
                      "dot_hazard_class": 3
                    }
                  }
                },
                {
                  "name": "fragileSku",
                  "summary": "SKU-1 classified as Fragile only (no optional fields).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a4c1e66-3d57-4f20-b8e9-2a6d0c5f7b13",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.product.ProductClassified",
                    "subject": "SKU-1",
                    "time": "2026-10-06T12:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:ProductClassified:v1",
                    "data": {
                      "sku": "SKU-1",
                      "handling_tags": [
                        "Fragile"
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
    "warehouse.inventory.analytics": {
      "description": "The internal analytics topic feeding this service's Inventory Flow & Accuracy data product (ADR-0011), the `AnalyticsTopic` constant in `internal/adapters/outbound/kafka/analytics_publisher.go`. Same CloudEvents envelope and `type` strings as the integration topic, but `dataschema` is `urn:warehouse:inventory-storage:analytics:<EventName>:v1` and `data` is the analytics payload (snake_case, enriched with `sku` for reservation-lifecycle events). Consumed only by this service's own projector (`cmd/inventory-projector`), which dispatches on the full `type`, dedupes on `id`, and skips (WARN) anything that is not a valid CloudEvent. `ProductClassified` (ADR 0031) shares this topic and is acknowledged without touching the read model.\n",
      "subscribe": {
        "operationId": "consumeInventoryStorageAnalytics",
        "summary": "Consume inventory-storage analytics events (internal).",
        "description": "Internal stream for the analytics projector. CloudEvents 1.0 structured mode with the analytics `dataschema`; dispatch on the full `type`, dedupe on `id`, ignore unknown types.\n",
        "tags": [
          {
            "name": "inventory-storage",
            "description": "Events emitted by the inventory-storage bounded context."
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "StockReceived",
              "title": "Stock Received",
              "summary": "Goods were received against a SKU and staged, awaiting stow.",
              "description": "Raised by the ReceiveStock use case when inbound goods are booked in against a SKU. The quantity is *staged* — it is not yet in a bin and is therefore not usable; it becomes usable only once ItemStowed records the bin it landed in.\n\nPublished to `warehouse.inventory.analytics` only (subject = SKU, Kafka key = SKU). Analytics `data`: `{sku, quantity}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "stock",
                  "description": "Raised by the StockUnit aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a StockReceived domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for StockReceived.",
                        "const": "com.warehouse.wms.inventory-storage.stock.StockReceived",
                        "x-parser-schema-id": "<anonymous-schema-69>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:StockReceived:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:StockReceived:v1$",
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for StockReceived.",
                        "required": [
                          "sku",
                          "quantity"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit the goods were received against.",
                            "x-parser-schema-id": "<anonymous-schema-72>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity received and staged. Always positive; the domain rejects a non-positive receipt.\n",
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-68>"
                  }
                ],
                "x-parser-schema-id": "StockReceivedEvent"
              },
              "examples": [
                {
                  "name": "receivedFiftyUnits",
                  "summary": "Fifty units of SKU-1001 received and staged.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8f6b1c2e-6c1e-4c0a-9b3a-2f4d5e6a7b81",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.stock.StockReceived",
                    "subject": "SKU-1001",
                    "time": "2026-08-21T22:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:StockReceived:v1",
                    "data": {
                      "sku": "SKU-1001",
                      "quantity": 50
                    }
                  }
                }
              ]
            },
            {
              "name": "ItemStowed",
              "title": "Item Stowed",
              "summary": "A quantity of a SKU was placed into a bin.",
              "description": "Raised by the StowStock use case once BOTH an item scan and a location scan are present — a stow without both is rejected, because skipping either is precisely how inventory gets lost. Chaotic storage applies: any SKU may go into any free bin, provided the bin's capacity is not exceeded. This is the point at which the quantity becomes usable.\n\nPublished to `warehouse.inventory.analytics` only (subject = SKU, Kafka key = SKU). Analytics `data`: `{sku, bin_id, quantity}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "stock",
                  "description": "Raised by the StockUnit aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for an ItemStowed domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for ItemStowed.",
                        "const": "com.warehouse.wms.inventory-storage.stock.ItemStowed",
                        "x-parser-schema-id": "<anonymous-schema-75>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ItemStowed:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ItemStowed:v1$",
                        "x-parser-schema-id": "<anonymous-schema-76>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for ItemStowed.",
                        "required": [
                          "sku",
                          "bin_id",
                          "quantity"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit that was stowed (the item scan).",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "bin_id": {
                            "type": "string",
                            "description": "The bin the quantity was placed into (the location scan). Chaotic storage: any SKU may occupy any free bin.\n",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity placed into the bin. Always positive.",
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-77>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-74>"
                  }
                ],
                "x-parser-schema-id": "ItemStowedEvent"
              },
              "examples": [
                {
                  "name": "stowedIntoBinA12",
                  "summary": "Fifty units of SKU-1001 stowed into bin A-12-3.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2c5d9a71-3b6f-4a18-8e2c-91d0f7b4c6a2",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.stock.ItemStowed",
                    "subject": "SKU-1001",
                    "time": "2026-08-21T22:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:ItemStowed:v1",
                    "data": {
                      "sku": "SKU-1001",
                      "bin_id": "A-12-3",
                      "quantity": 50
                    }
                  }
                }
              ]
            },
            {
              "name": "ItemUnlocated",
              "title": "Item Unlocated",
              "summary": "A physical item's bin is no longer known — the stock is lost.",
              "description": "Raised by the RunCycleCount use case when a count comes up short: the quantity the system believed was in the bin is not there, so the affected StockUnit quantity is flagged Unlocated and removed from usable. This is the explicit escape hatch for the \"every item has exactly one known bin\" rule.\n\nPublished to `warehouse.inventory.analytics` only (subject = stock unit id, Kafka key = SKU). Analytics `data`: `{sku, bin_id, stock_unit_id, quantity}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "stock",
                  "description": "Raised by the StockUnit aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for an ItemUnlocated domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for ItemUnlocated.",
                        "const": "com.warehouse.wms.inventory-storage.stock.ItemUnlocated",
                        "x-parser-schema-id": "<anonymous-schema-82>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ItemUnlocated:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ItemUnlocated:v1$",
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for ItemUnlocated.",
                        "required": [
                          "stock_unit_id",
                          "sku",
                          "bin_id",
                          "quantity"
                        ],
                        "properties": {
                          "stock_unit_id": {
                            "type": "string",
                            "description": "Identifier of the StockUnit that was flagged Unlocated.",
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit that could not be found.",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          },
                          "bin_id": {
                            "type": "string",
                            "description": "The bin the stock was believed to be in.",
                            "x-parser-schema-id": "<anonymous-schema-87>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity that could not be accounted for, now removed from usable inventory.\n",
                            "x-parser-schema-id": "<anonymous-schema-88>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-84>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-81>"
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
                    "dataschema": "urn:warehouse:inventory-storage:analytics:ItemUnlocated:v1",
                    "data": {
                      "stock_unit_id": "su-7781",
                      "sku": "SKU-1001",
                      "bin_id": "A-12-3",
                      "quantity": 3
                    }
                  }
                }
              ]
            },
            "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0]",
            {
              "name": "StockPicked",
              "title": "Stock Picked",
              "summary": "Reserved quantity was physically removed from its bin.",
              "description": "Raised by the ConfirmPick use case. It consumes the reservation — a reservation cannot be double-consumed — and permanently removes the quantity from on-hand. Grouped under the `reservation` entity segment because the reservation id is the only identity the event carries.\n\nPublished to `warehouse.inventory.analytics` only (subject = reservation id, Kafka key = reservation id — ADR 0021). Analytics `data`: `{sku, reservation_id, quantity}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Raised by the Reservation aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a StockPicked domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for StockPicked.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.StockPicked",
                        "x-parser-schema-id": "<anonymous-schema-90>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:StockPicked:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:StockPicked:v1$",
                        "x-parser-schema-id": "<anonymous-schema-91>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for StockPicked.",
                        "required": [
                          "reservation_id",
                          "sku",
                          "quantity"
                        ],
                        "properties": {
                          "reservation_id": {
                            "type": "string",
                            "description": "Identifier of the reservation that was consumed by this pick. A reservation can be consumed only once.\n",
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit that was picked.",
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity physically removed from its bin and permanently deducted from on-hand.\n",
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-92>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-89>"
                  }
                ],
                "x-parser-schema-id": "StockPickedEvent"
              },
              "examples": [
                {
                  "name": "pickConfirmed",
                  "summary": "Reservation res-1 consumed; five units of SKU-1 picked.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a3c7e52-1d84-4b60-92f7-5e8b0c4a6d13",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.StockPicked",
                    "subject": "res-1",
                    "time": "2026-08-21T22:12:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:StockPicked:v1",
                    "data": {
                      "reservation_id": "res-1",
                      "sku": "SKU-1",
                      "quantity": 5
                    }
                  }
                }
              ]
            },
            {
              "name": "ReservationExpired",
              "title": "Reservation Expired",
              "summary": "A reservation's timeout elapsed before pick confirmation.",
              "description": "Describes a reservation that timed out without being confirmed or revoked, so its quantity returns to usable. Raised lazily: the Reservation aggregate's `IsExpired`/`Expire()` are invoked the next time the reservation is read (GetReservationsByDemandRef, RevokeReservation, ConfirmPick, or ReserveStock's own idempotency lookup), not by a background sweeper — see ADR 0003's \"Lazy expiry\" section for the full rationale.\n\nPublished to `warehouse.inventory.analytics` only (subject = Kafka key = reservation id), with the reservation's SKU enriched in: analytics `data` is `{reservation_id, sku}`. It does not cross to the integration topic.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "reservation",
                  "description": "Raised by the Reservation aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a ReservationExpired domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for ReservationExpired.",
                        "const": "com.warehouse.wms.inventory-storage.reservation.ReservationExpired",
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ReservationExpired:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ReservationExpired:v1$",
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for ReservationExpired.",
                        "required": [
                          "reservation_id",
                          "sku"
                        ],
                        "properties": {
                          "reservation_id": {
                            "type": "string",
                            "description": "Identifier of the reservation whose timeout elapsed. Its quantity returns to usable inventory.\n",
                            "x-parser-schema-id": "<anonymous-schema-100>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The reservation's SKU, enriched by the publisher through ports.ReservationRepo. Empty if the reservation could not be found (best-effort enrichment).\n",
                            "x-parser-schema-id": "<anonymous-schema-101>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-99>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  }
                ],
                "x-parser-schema-id": "ReservationExpiredEvent"
              },
              "examples": [
                {
                  "name": "reservationTimedOut",
                  "summary": "Reservation res-9 timed out before its pick was confirmed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6d1c8b45-2e70-4f39-9a5b-c0e7d2f14b36",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.reservation.ReservationExpired",
                    "subject": "res-9",
                    "time": "2026-08-21T22:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:ReservationExpired:v1",
                    "data": {
                      "reservation_id": "res-9",
                      "sku": "SKU-1"
                    }
                  }
                }
              ]
            },
            "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[1]",
            {
              "name": "CycleCountCompleted",
              "title": "Cycle Count Completed",
              "summary": "A bin's contents were verified against system records.",
              "description": "Raised by the RunCycleCount use case once a bin has been counted and reconciled. The `discrepancy` flag says whether the counted quantity matched the system quantity; when it did not, a DiscrepancyDetected event and possibly ItemUnlocated events are emitted alongside this one.\n\nPublished to `warehouse.inventory.analytics` only (subject = bin id, Kafka key = bin id). Analytics `data`: `{bin_id, counted, system, discrepancy}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "bin",
                  "description": "Raised by the Bin/Location aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a CycleCountCompleted domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for CycleCountCompleted.",
                        "const": "com.warehouse.wms.inventory-storage.bin.CycleCountCompleted",
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:CycleCountCompleted:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:CycleCountCompleted:v1$",
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for CycleCountCompleted.",
                        "required": [
                          "bin_id",
                          "counted",
                          "system",
                          "discrepancy"
                        ],
                        "properties": {
                          "bin_id": {
                            "type": "string",
                            "description": "The bin whose contents were verified.",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "counted": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity physically counted in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "system": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity the system believed was in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "discrepancy": {
                            "type": "boolean",
                            "description": "Whether counted and system quantities differed. When true, a DiscrepancyDetected event accompanies this one.\n",
                            "x-parser-schema-id": "<anonymous-schema-109>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-105>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-102>"
                  }
                ],
                "x-parser-schema-id": "CycleCountCompletedEvent"
              },
              "examples": [
                {
                  "name": "countMatchedSystem",
                  "summary": "Bin A-12-3 counted at 50 units, matching the system record.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f8b6d24-0a57-4e93-b1d8-6c2f7a9e4051",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.bin.CycleCountCompleted",
                    "subject": "A-12-3",
                    "time": "2026-08-21T23:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:analytics:CycleCountCompleted:v1",
                    "data": {
                      "bin_id": "A-12-3",
                      "counted": 50,
                      "system": 50,
                      "discrepancy": false
                    }
                  }
                }
              ]
            },
            {
              "name": "DiscrepancyDetected",
              "title": "Discrepancy Detected",
              "summary": "A cycle count found system records did not match physical reality.",
              "description": "Raised by the RunCycleCount use case when the counted quantity differs from the system quantity for a bin, before reconciliation is applied. A shortfall additionally produces ItemUnlocated events for the quantity that could not be found.\n\nPublished to `warehouse.inventory.analytics` only (subject = bin id, Kafka key = bin id). Analytics `data`: `{bin_id, counted, system}`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "bin",
                  "description": "Raised by the Bin/Location aggregate."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a DiscrepancyDetected domain event.",
                "allOf": [
                  "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "required": [
                      "type",
                      "data"
                    ],
                    "properties": {
                      "type": {
                        "type": "string",
                        "description": "Fixed event type for DiscrepancyDetected.",
                        "const": "com.warehouse.wms.inventory-storage.bin.DiscrepancyDetected",
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:DiscrepancyDetected:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:DiscrepancyDetected:v1$",
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for DiscrepancyDetected.",
                        "required": [
                          "bin_id",
                          "counted",
                          "system"
                        ],
                        "properties": {
                          "bin_id": {
                            "type": "string",
                            "description": "The bin whose count did not match system records.",
                            "x-parser-schema-id": "<anonymous-schema-114>"
                          },
                          "counted": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity physically counted in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-115>"
                          },
                          "system": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity the system believed was in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-116>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-110>"
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
                    "dataschema": "urn:warehouse:inventory-storage:analytics:DiscrepancyDetected:v1",
                    "data": {
                      "bin_id": "A-12-3",
                      "counted": 47,
                      "system": 50
                    }
                  }
                }
              ]
            },
            "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[4]"
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "StockReceived": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[0]",
      "ItemStowed": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[1]",
      "LocationRecorded": {
        "name": "LocationRecorded",
        "title": "Location Recorded",
        "summary": "A bin now authoritatively holds a given StockUnit.",
        "description": "Raised by the StowStock use case immediately after ItemStowed. It binds a StockUnit id to a bin id, which is the invariant this whole bounded context exists to protect: every physical item has exactly one known bin, or is explicitly flagged Unlocated.\n\nIn-process only — not published to any Kafka topic. Documented as part of the domain-event catalog.\n",
        "contentType": "application/cloudevents+json",
        "tags": [
          {
            "name": "stock",
            "description": "Raised by the StockUnit aggregate."
          }
        ],
        "payload": {
          "description": "CloudEvents envelope for a LocationRecorded domain event.",
          "allOf": [
            "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
            {
              "type": "object",
              "required": [
                "type",
                "data"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "description": "Fixed event type for LocationRecorded.",
                  "const": "com.warehouse.wms.inventory-storage.stock.LocationRecorded",
                  "x-parser-schema-id": "<anonymous-schema-118>"
                },
                "dataschema": {
                  "type": "string",
                  "description": "Reserved for if LocationRecorded is ever published; it is in-process only today.",
                  "pattern": "^urn:warehouse:inventory-storage:events:LocationRecorded:v1$",
                  "x-parser-schema-id": "<anonymous-schema-119>"
                },
                "data": {
                  "type": "object",
                  "description": "Business payload for LocationRecorded.",
                  "required": [
                    "stock_unit_id",
                    "bin_id"
                  ],
                  "properties": {
                    "stock_unit_id": {
                      "type": "string",
                      "description": "Identifier of the StockUnit whose location is now known.",
                      "x-parser-schema-id": "<anonymous-schema-121>"
                    },
                    "bin_id": {
                      "type": "string",
                      "description": "The bin that authoritatively holds that StockUnit.",
                      "x-parser-schema-id": "<anonymous-schema-122>"
                    }
                  },
                  "x-parser-schema-id": "<anonymous-schema-120>"
                }
              },
              "x-parser-schema-id": "<anonymous-schema-117>"
            }
          ],
          "x-parser-schema-id": "LocationRecordedEvent"
        },
        "examples": [
          {
            "name": "locationRecordedForStockUnit",
            "summary": "StockUnit su-7781 is recorded as living in bin A-12-3.",
            "payload": {
              "specversion": "1.0",
              "id": "b0e4f3d9-5a72-4c61-b8f0-3d9c2e1a4f57",
              "source": "/warehouse/inventory-storage",
              "type": "com.warehouse.wms.inventory-storage.stock.LocationRecorded",
              "subject": "su-7781",
              "time": "2026-08-21T22:05:01Z",
              "datacontenttype": "application/json",
              "dataschema": "urn:warehouse:inventory-storage:events:LocationRecorded:v1",
              "data": {
                "stock_unit_id": "su-7781",
                "bin_id": "A-12-3"
              }
            }
          }
        ]
      },
      "ProductClassified": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[4]",
      "StockReserved": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0]",
      "TransferStockAllocated": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[2]",
      "TransferStockAllocationRejected": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[3]",
      "ReservationExpired": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[5]",
      "ReservationRevoked": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[1]",
      "StockPicked": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[4]",
      "ItemUnlocated": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[2]",
      "CycleCountCompleted": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[7]",
      "DiscrepancyDetected": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[8]"
    },
    "schemas": {
      "CloudEventBase": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "StockReceivedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[0].payload",
      "ItemStowedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[1].payload",
      "LocationRecordedEvent": "$ref:$.components.messages.LocationRecorded.payload",
      "ProductClassifiedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[4].payload",
      "StockReservedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload",
      "ReservationExpiredEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[5].payload",
      "ReservationRevokedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[1].payload",
      "StockPickedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[4].payload",
      "ItemUnlocatedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[2].payload",
      "CycleCountCompletedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[7].payload",
      "DiscrepancyDetectedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[8].payload",
      "TransferStockAllocatedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[2].payload",
      "TransferStockAllocationRejectedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[3].payload"
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
  