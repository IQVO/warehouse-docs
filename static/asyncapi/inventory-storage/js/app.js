
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Inventory & Storage Domain Events",
    "version": "1.0.0",
    "description": "Domain-event catalog for the **inventory-storage** bounded context, the WMS-tier authoritative record of what is held where, and what portion of it is usable. This context implements Amazon-style chaotic (random) stow: there is no fixed product location — an inbound item may be stowed into any free bin, and this service records the exact bin it landed in. It supplies \"stock reality\" to the Work Planning bounded context (wes-work-planning) and makes allocation a *revocable* reservation, so a failed physical pick never strands an order.\n\n**Envelope.** Every message on this channel is a CloudEvents 1.0 *structured-mode* JSON document with content type `application/cloudevents+json`. The CloudEvents context attributes carry routing and identity (`specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype`); the business payload lives entirely under `data`. `source` is always `/warehouse/inventory-storage`, and `subject` is the id of the aggregate instance the event is about (a reservation id, a stock unit id, or a bin id).\n\n**The `type` attribute** follows the platform-wide reverse-DNS convention `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>` — all lowercase except the final PascalCase event name. For this context the subdomain is `wms` (Warehouse Management System, a core subdomain) and the bounded context is `inventory-storage`, so for example a stow produces `com.warehouse.wms.inventory-storage.stock.ItemStowed` and a revoked allocation produces `com.warehouse.wms.inventory-storage.reservation.ReservationRevoked`.\n\n**Aggregates and entity groupings.** Three aggregates raise every event documented here. The **StockUnit** aggregate (entity segment `stock`) raises `StockReceived`, `ItemStowed`, `LocationRecorded` and `ItemUnlocated`. The **Reservation** aggregate (entity segment `reservation`) raises `StockReserved`, `ReservationExpired`, `ReservationRevoked` and `StockPicked` — `StockPicked` is grouped with the reservation because it is emitted by ConfirmPick when a reservation is consumed, and reservation id is the only identity it carries. The **Bin/Location** aggregate (entity segment `bin`) raises `CycleCountCompleted` and `DiscrepancyDetected`.\n\n**What reaches Kafka.** This document is the complete domain-event catalog for the bounded context. Two topics carry a subset of it: `warehouse.inventory.events` (the integration contract — `StockReserved`, `ReservationRevoked`, the transfer replies, the transfer receipt/stow events, and the legacy `ProductClassified`, from `internal/adapters/outbound/kafka/publisher.go`) and `warehouse.inventory.analytics` (the analytics data product — every message below except `LocationRecorded` and `ProductClassified`, from `internal/adapters/outbound/kafka/analytics_publisher.go`). Each message says which topics it reaches. `LocationRecorded` is in-process only (no consumer; decided 2026-10-06). Since ADR 0034 product-master owns product classification: `ProductClassified` is no longer raised by any write path and is emitted only by the one-shot `republish-product-classifications` backfill command (product-master ADR 0003 stage B), on the integration topic.\n\n**Consumed.** This service also consumes product-master's `warehouse.product-master.events` (channel below, ADR 0034) into a local copy of every SKU's classification that StowStock reads. Applying it raises no event here. It also consumes fulfillment-execution's `TaskCompleted` from `warehouse.fulfillment.events` (channel below, ADR 0035) to confirm a completed order's reservations as picked once the order's LAST PICK task completes (one PICK task per order line, counted per order); that raises this service's own `StockPicked` (analytics topic) per reservation.\n\n**CloudEvents is mandatory (ADR-0024).** Every message on both topics is exactly the CloudEvents 1.0 structured-mode event documented here — all of `specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype` and `dataschema` are required — and every Kafka message carries the header `content-type: application/cloudevents+json; charset=UTF-8`. The same `type` names an occurrence on both topics; `dataschema` (`urn:warehouse:inventory-storage:<events|analytics>:<EventName>:v1`) names the payload shape. Each schema's `data` is the exact wire payload; `StockReserved` and `ReservationRevoked`, which reach both topics, give one `data` shape per `dataschema`. There is no other envelope.\n",
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
      "description": "Events about SKU-level handling master data (hazmat, fragile, temperature, ...). Owned by product-master since ADR 0034; this service only re-emits its legacy `ProductClassified` from the one-shot backfill command and consumes product-master's own events.\n"
    },
    {
      "name": "product-master",
      "description": "Events consumed from the product-master bounded context (wms subdomain), the owner of SKU master data (ADR 0034).\n"
    },
    {
      "name": "fulfillment-execution",
      "description": "Events consumed from the fulfillment-execution bounded context (wes subdomain): TaskCompleted, from which picks are confirmed (ADR 0035).\n"
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
      "description": "The outbound integration topic for this bounded context (the `Topic` constant in `internal/adapters/outbound/kafka/publisher.go`). Reaching it: `StockReserved` and `ReservationRevoked` (keyed by reservation id), the transfer replies and receipt/stow events (keyed by transfer line id), and the legacy `ProductClassified` (keyed by SKU), which since ADR 0034 only the one-shot `republish-product-classifications` backfill emits (product-master's legacy importer consumes it). The primary downstream consumer is wes-work-planning, which dispatches on their full `type` strings and projects them into its `UsableInventoryObserved` read model, keyed by SKU.\n",
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
              "name": "TransferReceiptStaged",
              "title": "Transfer Receipt Staged",
              "summary": "A destination site counted goods against a recognized ALLOCATED transfer line.",
              "description": "Raised by the StageTransferReceipt use case (ADR 0033, destination receipt custody — POST /transfers/{transferLineId}/receipt). The transfer_line_id was found in the transfer_allocations ledger with outcome ALLOCATED: a transfer_receipts row (state STAGED, DB-unique on transfer_line_id) now records expected_quantity from the ledger, received_quantity as counted, and the SIGNED variance (received - expected; positive = over, negative = short). Over/short is explicit on the wire, never silently absorbed.\n\nNO usable stock moves at this step — the destination site's usable rises only when the stow completes (TransferStockStowed). An unrecognized scan is NOT this event: it is quarantined as an inventory_exceptions row and publishes nothing that raises availability.\n\n**Integration topic only** (no analytics variant: the Inventory Flow & Accuracy projection has no transfer dimension). Kafka key and CloudEvents `subject` are the transfer_line_id, so a line's stage-then-stow facts stay ordered on one partition (ADR 0021).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "stock",
                  "description": "Raised on the destination receipt custody path (ADR 0033)."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a TransferReceiptStaged domain event (ADR 0033).",
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
                        "description": "Fixed event type for TransferReceiptStaged.",
                        "const": "com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:TransferReceiptStaged:v1",
                        "pattern": "^urn:warehouse:inventory-storage:events:TransferReceiptStaged:v1$",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for TransferReceiptStaged. The receipt is STAGED: counted, not yet placed; no usable stock moved.",
                        "required": [
                          "transfer_id",
                          "transfer_line_id",
                          "destination_site_id",
                          "sku",
                          "expected_quantity",
                          "received_quantity",
                          "variance"
                        ],
                        "properties": {
                          "transfer_id": {
                            "type": "string",
                            "description": "The planning context's transfer (saga) id.",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "transfer_line_id": {
                            "type": "string",
                            "description": "The transfer line this receipt stages; DB-unique in transfer_receipts.",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "destination_site_id": {
                            "type": "string",
                            "description": "The receiving site whose dock counted the goods.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit counted.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "expected_quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "What the transfer_allocations ledger promised (requested_quantity).",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "received_quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "What was physically counted at the dock.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "variance": {
                            "type": "integer",
                            "description": "SIGNED received - expected. Positive = over-receipt, negative = short-receipt, 0 = exact. Explicit, never silently absorbed.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  }
                ],
                "x-parser-schema-id": "TransferReceiptStagedEvent"
              },
              "examples": [
                {
                  "name": "shortReceiptStaged",
                  "summary": "Five of six expected units of SKU-T1 counted at SITE-DEST (short by one).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8c2f4e71-a5b3-4c68-d9e0-1f4a7b8c9d21",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged",
                    "subject": "tl-77-1",
                    "time": "2026-10-06T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:TransferReceiptStaged:v1",
                    "data": {
                      "transfer_id": "tr-77",
                      "transfer_line_id": "tl-77-1",
                      "destination_site_id": "SITE-DEST",
                      "sku": "SKU-T1",
                      "expected_quantity": 6,
                      "received_quantity": 5,
                      "variance": -1
                    }
                  }
                }
              ]
            },
            {
              "name": "TransferStockStowed",
              "title": "Transfer Stock Stowed",
              "summary": "A staged transfer receipt was placed into destination bins — destination usable rose, exactly once.",
              "description": "Raised by the StowTransferStock use case (ADR 0033 — POST /transfers/{transferLineId}/stow): the ONLY path that raises the destination site's usable stock for a transfer. One StockUnit per bin leg was created AT the destination site (NewStockUnitAtSite), every bin verified to belong to that site's custody, the quantities summed exactly to the receipt's received_quantity, and the receipt moved STAGED -> STOWED.\n\nIdempotent at the database level: a replayed stow for a STOWED receipt returns the original outcome and republishes NOTHING — exactly one of these events exists per transfer_line_id.\n\n**Integration topic only** (no analytics variant). Kafka key and CloudEvents `subject` are the transfer_line_id, matching TransferReceiptStaged so a line's facts stay per-line ordered (ADR 0021).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "stock",
                  "description": "Raised on the destination stow custody path (ADR 0033)."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for a TransferStockStowed domain event (ADR 0033).",
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
                        "description": "Fixed event type for TransferStockStowed.",
                        "const": "com.warehouse.wms.inventory-storage.stock.TransferStockStowed",
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:TransferStockStowed:v1",
                        "pattern": "^urn:warehouse:inventory-storage:events:TransferStockStowed:v1$",
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      },
                      "data": {
                        "type": "object",
                        "description": "Business payload for TransferStockStowed. The destination site's usable stock rose by exactly received_quantity, once, through the StockUnits listed in allocations.",
                        "required": [
                          "transfer_id",
                          "transfer_line_id",
                          "destination_site_id",
                          "sku",
                          "received_quantity",
                          "stowed_quantity",
                          "allocations"
                        ],
                        "properties": {
                          "transfer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "transfer_line_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "destination_site_id": {
                            "type": "string",
                            "description": "The site whose custody the new StockUnits were created in.",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "received_quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "The receipt's counted quantity.",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "stowed_quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Total quantity placed (equals received_quantity).",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          },
                          "allocations": {
                            "type": "array",
                            "minItems": 1,
                            "description": "The destination StockUnits created, with the bin each was placed into.",
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
                                  "x-parser-schema-id": "<anonymous-schema-82>"
                                },
                                "bin_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-83>"
                                },
                                "quantity": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-84>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-81>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-70>"
                  }
                ],
                "x-parser-schema-id": "TransferStockStowedEvent"
              },
              "examples": [
                {
                  "name": "stowedIntoTwoBins",
                  "summary": "Five units of SKU-T1 placed into two SITE-DEST bins.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9d3a5f82-b6c4-4d79-e0f1-2a5b8c9d0e32",
                    "source": "/warehouse/inventory-storage",
                    "type": "com.warehouse.wms.inventory-storage.stock.TransferStockStowed",
                    "subject": "tl-77-1",
                    "time": "2026-10-06T12:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inventory-storage:events:TransferStockStowed:v1",
                    "data": {
                      "transfer_id": "tr-77",
                      "transfer_line_id": "tl-77-1",
                      "destination_site_id": "SITE-DEST",
                      "sku": "SKU-T1",
                      "received_quantity": 5,
                      "stowed_quantity": 5,
                      "allocations": [
                        {
                          "stock_unit_id": "su-dest-1",
                          "bin_id": "BIN-DEST-1",
                          "quantity": 3
                        },
                        {
                          "stock_unit_id": "su-dest-2",
                          "bin_id": "BIN-DEST-2",
                          "quantity": 2
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductClassified",
              "title": "Product Classified (legacy, backfill only)",
              "summary": "A SKU's handling classification, re-emitted by the one-shot backfill.",
              "description": "LEGACY (ADR 0034). product-master owns product classification; no write path in this service raises this event any more. It is emitted only by the one-shot `republish-product-classifications` command (product-master ADR 0003 stage B): one message per `product_classifications` row, enqueued through the transactional outbox and published by the running pod's relay, on `warehouse.inventory.events` only (dataschema `urn:warehouse:inventory-storage:events:ProductClassified:v1`). product-master's legacy importer turns it into product-master data. The wire contract is unchanged from ADR 0031. Retired at product-master ADR 0003 stage E.\n\nCloudEvents `subject` and the Kafka key are the SKU. `data` is `{sku, handling_tags, temperature_class?, dot_hazard_class?}`. It is a **full-state replacement**: overwrite your local row; an absent optional field means \"none\". `handling_tags` is in the stable enum order. No PII. Re-running the backfill re-emits the same states, which is harmless.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "product",
                  "description": "Legacy SKU master-data event (backfill only)."
                }
              ],
              "payload": {
                "description": "CloudEvents envelope for the legacy ProductClassified event. Since ADR 0034 only the integration-topic (`events`) variant is emitted, by the backfill command; the `analytics` dataschema is still accepted by the encoder's frozen contract but no longer produced.\n",
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
                        "x-parser-schema-id": "<anonymous-schema-86>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:events:ProductClassified:v1 on the integration topic, ...:analytics:ProductClassified:v1 on the analytics topic.",
                        "pattern": "^urn:warehouse:inventory-storage:(events|analytics):ProductClassified:v1$",
                        "x-parser-schema-id": "<anonymous-schema-87>"
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
                            "x-parser-schema-id": "<anonymous-schema-89>"
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
                              "x-parser-schema-id": "<anonymous-schema-91>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "temperature_class": {
                            "type": "string",
                            "enum": [
                              "Ambient",
                              "Chilled",
                              "Frozen"
                            ],
                            "description": "Present if and only if handling_tags includes TemperatureSensitive.",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          },
                          "dot_hazard_class": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 9,
                            "description": "Top-level US DOT hazard class; present only for a Hazmat classification with one recorded (ADR 0010).",
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-85>"
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
                    "dataschema": "urn:warehouse:inventory-storage:events:ProductClassified:v1",
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
      "description": "The internal analytics topic feeding this service's Inventory Flow & Accuracy data product (ADR-0011), the `AnalyticsTopic` constant in `internal/adapters/outbound/kafka/analytics_publisher.go`. Same CloudEvents envelope and `type` strings as the integration topic, but `dataschema` is `urn:warehouse:inventory-storage:analytics:<EventName>:v1` and `data` is the analytics payload (snake_case, enriched with `sku` for reservation-lifecycle events). Consumed only by this service's own projector (`cmd/inventory-projector`), which dispatches on the full `type`, dedupes on `id`, and skips (WARN) anything that is not a valid CloudEvent. `ProductClassified` no longer reaches this topic (ADR 0034: the write path stopped raising it and the backfill writes the integration topic only); the projector would acknowledge it without touching the read model.\n",
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
                        "x-parser-schema-id": "<anonymous-schema-95>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:StockReceived:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:StockReceived:v1$",
                        "x-parser-schema-id": "<anonymous-schema-96>"
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
                            "x-parser-schema-id": "<anonymous-schema-98>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity received and staged. Always positive; the domain rejects a non-positive receipt.\n",
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-94>"
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
                        "x-parser-schema-id": "<anonymous-schema-101>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ItemStowed:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ItemStowed:v1$",
                        "x-parser-schema-id": "<anonymous-schema-102>"
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
                            "x-parser-schema-id": "<anonymous-schema-104>"
                          },
                          "bin_id": {
                            "type": "string",
                            "description": "The bin the quantity was placed into (the location scan). Chaotic storage: any SKU may occupy any free bin.\n",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity placed into the bin. Always positive.",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-100>"
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
                        "x-parser-schema-id": "<anonymous-schema-108>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ItemUnlocated:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ItemUnlocated:v1$",
                        "x-parser-schema-id": "<anonymous-schema-109>"
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
                            "x-parser-schema-id": "<anonymous-schema-111>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit that could not be found.",
                            "x-parser-schema-id": "<anonymous-schema-112>"
                          },
                          "bin_id": {
                            "type": "string",
                            "description": "The bin the stock was believed to be in.",
                            "x-parser-schema-id": "<anonymous-schema-113>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity that could not be accounted for, now removed from usable inventory.\n",
                            "x-parser-schema-id": "<anonymous-schema-114>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-110>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-107>"
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
                        "x-parser-schema-id": "<anonymous-schema-116>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:StockPicked:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:StockPicked:v1$",
                        "x-parser-schema-id": "<anonymous-schema-117>"
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
                            "x-parser-schema-id": "<anonymous-schema-119>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The stock keeping unit that was picked.",
                            "x-parser-schema-id": "<anonymous-schema-120>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Quantity physically removed from its bin and permanently deducted from on-hand.\n",
                            "x-parser-schema-id": "<anonymous-schema-121>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-118>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-115>"
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
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:ReservationExpired:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:ReservationExpired:v1$",
                        "x-parser-schema-id": "<anonymous-schema-124>"
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
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "sku": {
                            "type": "string",
                            "description": "The reservation's SKU, enriched by the publisher through ports.ReservationRepo. Empty if the reservation could not be found (best-effort enrichment).\n",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-122>"
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
                        "x-parser-schema-id": "<anonymous-schema-129>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:CycleCountCompleted:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:CycleCountCompleted:v1$",
                        "x-parser-schema-id": "<anonymous-schema-130>"
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
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "counted": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity physically counted in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          },
                          "system": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity the system believed was in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          },
                          "discrepancy": {
                            "type": "boolean",
                            "description": "Whether counted and system quantities differed. When true, a DiscrepancyDetected event accompanies this one.\n",
                            "x-parser-schema-id": "<anonymous-schema-135>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-131>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-128>"
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
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      },
                      "dataschema": {
                        "type": "string",
                        "description": "urn:warehouse:inventory-storage:analytics:DiscrepancyDetected:v1",
                        "pattern": "^urn:warehouse:inventory-storage:analytics:DiscrepancyDetected:v1$",
                        "x-parser-schema-id": "<anonymous-schema-138>"
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
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          },
                          "counted": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity physically counted in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          },
                          "system": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "Quantity the system believed was in the bin.",
                            "x-parser-schema-id": "<anonymous-schema-142>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-136>"
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
            }
          ]
        }
      }
    },
    "warehouse.product-master.events": {
      "description": "product-master's integration topic, its Published Language for SKU master data (product-master ADR 0001; the `ProductMasterTopic` constant in `internal/adapters/inbound/kafka/product_master_consumer.go`). CONSUMED by this service (ADR 0034), not published: key = SKU, `source=/warehouse/product-master`, `subject` = SKU. Only `com.warehouse.wms.product-master.product.ProductClassified` is acted on; `ProductRegistered`, `ProductDescriptionChanged`, `ProductDimensionsDeclared` and `ProductMeasured` share the topic and are committed past untouched. The consumer runs only when `PRODUCT_MASTER_CONSUMER_GROUP` is set (stable group id; also requires `DATABASE_URL` and `KAFKA_BROKERS`).\n",
      "publish": {
        "operationId": "applyProductMasterClassification",
        "summary": "Apply product-master's ProductClassified to the local copy.",
        "description": "At-least-once, fixed group: FetchMessage, then CommitMessages only after the handler settles. The CloudEvents `id` is claimed in `processed_events` in the SAME transaction as the `product_classifications` upsert, which applies only when `version` is greater than the stored version (a missing row is inserted; legacy rows carry version 0). A transient database error retries the same message with capped backoff; a message that is not a valid CloudEvent, has an undecodable payload or breaks the classification invariants is logged and committed past. Nothing is published in response (no loop back to product-master).\n",
        "tags": [
          {
            "name": "product-master",
            "description": "Consumed from the product-master bounded context."
          }
        ],
        "message": {
          "name": "ProductMasterProductClassified",
          "title": "Product Classified (from product-master, consumed)",
          "summary": "product-master's full-state classification of a SKU, with its product version.",
          "description": "CONSUMED, not produced (ADR 0034). Pinned by product-master's `apis/asyncapi.yaml`: type `com.warehouse.wms.product-master.product.ProductClassified`, `source=/warehouse/product-master`, subject and Kafka key = SKU. `data` is the full classification plus `classification_source` (`native` | `legacy-import`) and the product `version`; this service applies a message only when `version` is greater than the version it stores for the SKU. `temperature_class` and `dot_hazard_class` are omitted when unset.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "product-master",
              "description": "Consumed from product-master."
            }
          ],
          "payload": {
            "type": "object",
            "description": "CloudEvents 1.0 envelope of product-master's ProductClassified as consumed here (not composed from CloudEventBase, whose `source` is this service's own).\n",
            "required": [
              "specversion",
              "id",
              "source",
              "type",
              "subject",
              "time",
              "datacontenttype",
              "data"
            ],
            "properties": {
              "specversion": {
                "type": "string",
                "enum": [
                  "1.0"
                ],
                "x-parser-schema-id": "<anonymous-schema-143>"
              },
              "id": {
                "type": "string",
                "description": "CloudEvents id; the dedupe key (claimed in processed_events).",
                "x-parser-schema-id": "<anonymous-schema-144>"
              },
              "source": {
                "type": "string",
                "enum": [
                  "/warehouse/product-master"
                ],
                "x-parser-schema-id": "<anonymous-schema-145>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wms.product-master.product.ProductClassified",
                "x-parser-schema-id": "<anonymous-schema-146>"
              },
              "subject": {
                "type": "string",
                "description": "The SKU (also the Kafka key).",
                "x-parser-schema-id": "<anonymous-schema-147>"
              },
              "time": {
                "type": "string",
                "format": "date-time",
                "x-parser-schema-id": "<anonymous-schema-148>"
              },
              "datacontenttype": {
                "type": "string",
                "enum": [
                  "application/json"
                ],
                "x-parser-schema-id": "<anonymous-schema-149>"
              },
              "dataschema": {
                "type": "string",
                "description": "urn:warehouse:product-master:events:ProductClassified:v1",
                "x-parser-schema-id": "<anonymous-schema-150>"
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
                    "x-parser-schema-id": "<anonymous-schema-152>"
                  },
                  "handling_tags": {
                    "type": "array",
                    "minItems": 1,
                    "description": "Stable order Hazmat, Fragile, TemperatureSensitive, Oversized, HighValue.",
                    "items": {
                      "type": "string",
                      "enum": [
                        "Hazmat",
                        "Fragile",
                        "TemperatureSensitive",
                        "Oversized",
                        "HighValue"
                      ],
                      "x-parser-schema-id": "<anonymous-schema-154>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-153>"
                  },
                  "temperature_class": {
                    "type": "string",
                    "enum": [
                      "Ambient",
                      "Chilled",
                      "Frozen"
                    ],
                    "description": "Present if and only if handling_tags includes TemperatureSensitive.",
                    "x-parser-schema-id": "<anonymous-schema-155>"
                  },
                  "dot_hazard_class": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 9,
                    "description": "Present only for a Hazmat classification with one recorded.",
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  },
                  "classification_source": {
                    "type": "string",
                    "enum": [
                      "native",
                      "legacy-import"
                    ],
                    "description": "Stored verbatim as product_classifications.classification_source.",
                    "x-parser-schema-id": "<anonymous-schema-157>"
                  },
                  "version": {
                    "type": "integer",
                    "format": "int64",
                    "minimum": 1,
                    "description": "product-master's Product.version; applied only when greater than the stored version.",
                    "x-parser-schema-id": "<anonymous-schema-158>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-151>"
              }
            },
            "x-parser-schema-id": "ProductMasterProductClassifiedEvent"
          },
          "examples": [
            {
              "name": "hazmatFrozenSku",
              "summary": "SKU-1 classified Hazmat + TemperatureSensitive (Frozen), DOT class 3, version 3.",
              "payload": {
                "specversion": "1.0",
                "id": "3f1c2b7a-8d4e-4c55-9a0b-6e2d1f7c8a90",
                "source": "/warehouse/product-master",
                "type": "com.warehouse.wms.product-master.product.ProductClassified",
                "subject": "SKU-1",
                "time": "2026-10-06T12:00:00Z",
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
    },
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's integration topic, its Published Language for task facts (the `FulfillmentTopic` constant in `internal/adapters/inbound/kafka/task_completed_consumer.go`). CONSUMED by this service (ADR 0035), not published: key = `subject` = task id, `source=/warehouse/fulfillment-execution`. Only `com.warehouse.wes.fulfillment-execution.task.TaskCompleted` is acted on; `TaskCPTMissed`, `PackageManifested` and the `Transfer*` facts share the topic and are committed past untouched. The consumer runs only when `TASK_COMPLETED_CONSUMER_MODE=kafka` (default `off`; also requires `DATABASE_URL` and `KAFKA_BROKERS`), under the fixed group `TASK_COMPLETED_CONSUMER_GROUP` (default `inventory-storage-confirm-pick`). Poison messages and messages whose handling kept failing are written to `warehouse.fulfillment.events.dlq`.\n",
      "publish": {
        "operationId": "confirmPicksFromTaskCompleted",
        "summary": "Confirm an order's picked reservations on the order's last TaskCompleted.",
        "description": "At-least-once, fixed group: FetchMessage, then CommitMessages only after the message settles. A PICK task is per order LINE and every one carries the same `order_ref`, while a reservation has no line identity (only sku, quantity and `demand_ref`), so a task cannot be matched to one reservation. For `task_type = PICK` with a non-empty `order_ref` (the OrderId order-management reserved against, stored here as `demand_ref`) the pick is COUNTED for the order (table `order_pick_progress`); only when the count reaches the order's ACTIVE + CONFIRMED reservations (REVOKED and EXPIRED are not awaited), i.e. on the LAST pick, is every ACTIVE reservation with that `demand_ref` confirmed through the existing ConfirmPick logic (stock decremented, bin capacity released, `StockPicked` raised). Earlier picks only record progress and settle as successful no-ops. The CloudEvents `id` claim in `processed_events`, the counter increment and all confirmations commit in ONE transaction, so a failure rolls everything back and the redelivery is applied in full; a redelivered id never advances the counter, and a further PICK event for an already confirmed order confirms nothing new. Counter rows older than `ORDER_PICK_PROGRESS_RETENTION` (default 720h) are swept. Reservations already CONFIRMED or REVOKED are skipped; an EXPIRED one (ADR 0003) is skipped, logged and counted (`inventory.pick_confirmations{outcome=expired}`), never an error. No reservations for the order (a transfer or non-inventory order), a non-PICK task, a missing `order_ref` (a producer that predates the field) and every other event type are successful no-ops. A Task carries no SKU or quantity, so SHORT PICKS ARE NOT MODELLED. The per-line path (order-management sends `line_no`, Reservation stores it, the event carries it) is recorded in ADR 0035. A transient failure retries the same message with capped backoff (5 attempts), then dead-letters it; an undecodable payload is dead-lettered at once; a message that is not a CloudEvent is skipped with a sampled WARN.\n",
        "tags": [
          {
            "name": "fulfillment-execution",
            "description": "Consumed from the fulfillment-execution bounded context."
          }
        ],
        "message": {
          "name": "FulfillmentTaskCompleted",
          "title": "Task Completed (from fulfillment-execution, consumed)",
          "summary": "A station finished a claimed task; the last PICK task of an order makes this service confirm the order's reservations as picked.",
          "description": "CONSUMED, not produced (ADR 0035). Pinned by fulfillment-execution's `apis/asyncapi.yaml`: type `com.warehouse.wes.fulfillment-execution.task.TaskCompleted`, `source=/warehouse/fulfillment-execution`, subject and Kafka key = task id. This service reads only `task_id`, `task_type` and `order_ref`; every other field (`station_id`, `work_unit_id`, `associate_id`, `duration_seconds`) is ignored. `order_ref` is the additive optional field of ADR 0035 (v1, omitted when empty): the task's order reference, i.e. the OrderId order-management used as `demand_ref`. A message without it, or with any `task_type` other than `PICK`, is a successful no-op.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "fulfillment-execution",
              "description": "Consumed from fulfillment-execution."
            }
          ],
          "payload": {
            "type": "object",
            "description": "CloudEvents 1.0 envelope of fulfillment-execution's TaskCompleted v1 as consumed here (not composed from CloudEventBase, whose `source` is this service's own). Only the fields this service reads are listed under `data`; the producer sends more.\n",
            "required": [
              "specversion",
              "id",
              "source",
              "type",
              "subject",
              "time",
              "datacontenttype",
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
                "description": "CloudEvents id; the dedupe key (claimed in processed_events under consumer `task-completed-confirm-pick`).",
                "x-parser-schema-id": "<anonymous-schema-160>"
              },
              "source": {
                "type": "string",
                "enum": [
                  "/warehouse/fulfillment-execution"
                ],
                "x-parser-schema-id": "<anonymous-schema-161>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "x-parser-schema-id": "<anonymous-schema-162>"
              },
              "subject": {
                "type": "string",
                "description": "The task id (also the Kafka key).",
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
                "description": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "x-parser-schema-id": "<anonymous-schema-166>"
              },
              "data": {
                "type": "object",
                "required": [
                  "task_id"
                ],
                "properties": {
                  "task_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-168>"
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
                    "description": "Only PICK is acted on; omitted by the producer when the task could not be found.",
                    "x-parser-schema-id": "<anonymous-schema-169>"
                  },
                  "order_ref": {
                    "type": "string",
                    "description": "The completed task's order reference = the OrderId order-management reserved against (this service's reservation `demand_ref`). Every PICK task of an order (one per order line) carries the same value; this service counts them and confirms on the last one. Additive and optional (ADR 0035): omitted when empty, in which case nothing is counted or confirmed.\n",
                    "x-parser-schema-id": "<anonymous-schema-170>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-167>"
              }
            },
            "x-parser-schema-id": "FulfillmentTaskCompletedEvent"
          },
          "examples": [
            {
              "name": "pickTaskCompleted",
              "summary": "One PICK task (one order line) of order ORD-1001 completed.",
              "payload": {
                "specversion": "1.0",
                "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.task.TaskCompleted",
                "subject": "task-8a1f",
                "time": "2026-10-06T15:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:TaskCompleted:v1",
                "data": {
                  "task_id": "task-8a1f",
                  "station_id": "station-03",
                  "work_unit_id": "wu-8a1f",
                  "associate_id": "worker-42",
                  "duration_seconds": 245,
                  "task_type": "PICK",
                  "order_ref": "ORD-1001"
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
                  "x-parser-schema-id": "<anonymous-schema-172>"
                },
                "dataschema": {
                  "type": "string",
                  "description": "Reserved for if LocationRecorded is ever published; it is in-process only today.",
                  "pattern": "^urn:warehouse:inventory-storage:events:LocationRecorded:v1$",
                  "x-parser-schema-id": "<anonymous-schema-173>"
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
                      "x-parser-schema-id": "<anonymous-schema-175>"
                    },
                    "bin_id": {
                      "type": "string",
                      "description": "The bin that authoritatively holds that StockUnit.",
                      "x-parser-schema-id": "<anonymous-schema-176>"
                    }
                  },
                  "x-parser-schema-id": "<anonymous-schema-174>"
                }
              },
              "x-parser-schema-id": "<anonymous-schema-171>"
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
      "ProductClassified": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[6]",
      "ProductMasterProductClassified": "$ref:$.channels.warehouse.product-master.events.publish.message",
      "FulfillmentTaskCompleted": "$ref:$.channels.warehouse.fulfillment.events.publish.message",
      "StockReserved": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0]",
      "TransferStockAllocated": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[2]",
      "TransferStockAllocationRejected": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[3]",
      "TransferReceiptStaged": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[4]",
      "TransferStockStowed": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[5]",
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
      "ProductClassifiedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[6].payload",
      "ProductMasterProductClassifiedEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.payload",
      "FulfillmentTaskCompletedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.payload",
      "StockReservedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[0].payload",
      "ReservationExpiredEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[5].payload",
      "ReservationRevokedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[1].payload",
      "StockPickedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[4].payload",
      "ItemUnlocatedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[2].payload",
      "CycleCountCompletedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[7].payload",
      "DiscrepancyDetectedEvent": "$ref:$.channels.warehouse.inventory.analytics.subscribe.message.oneOf[8].payload",
      "TransferStockAllocatedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[2].payload",
      "TransferStockAllocationRejectedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[3].payload",
      "TransferReceiptStagedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[4].payload",
      "TransferStockStowedEvent": "$ref:$.channels.warehouse.inventory.events.subscribe.message.oneOf[5].payload"
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
  