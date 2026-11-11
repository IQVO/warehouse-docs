
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "inbound-receiving Domain Events",
    "version": "1.0.0",
    "contact": {
      "name": "inbound-receiving maintainers",
      "url": "https://github.com/IQVO/inbound-receiving",
      "email": "inbound-receiving@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event catalog for the **inbound-receiving** bounded context (WMS subdomain):\nthe inbound dock workflow of ASNs, dock appointments and receipts\n(ADR 0001, ADR 0002).\n\n**Published.** The `Asn` and `Receipt` aggregates raise seven events,\npublished to `warehouse.inbound-receiving.events` through a\n**transactional outbox**: the aggregate row and its already-encoded events\nare written in ONE database transaction and a relay drains them to Kafka\n(at-least-once; the CloudEvents `id` is stored with the outbox row, so a\nretry republishes the same `id`). Consumers dedupe on `id`.\nThe four `dockappointment` types (Booked, CheckedIn, Cancelled, Completed)\nare **RETIRED**: the DockAppointment moved to dock-scheduling (ADR 0019,\nplan YD-0002), the backfill command that republished them is gone and\nthis service raises none (ADR 0022), so they are no longer declared. Read\ndock-scheduling's events instead.\n`ReceiptLineReceived` is the **handover event**: inventory-storage consumes\nit and books `condition=Good` quantities into stock (ADR 0003); Damaged\nquantities are recorded here and not booked.\n\n**Consumed (ADR 0003).** `ProductRegistered` from\n`warehouse.product-master.events` feeds the `known_skus` local copy\n(group from env `PRODUCT_CONSUMER_GROUP`); `ProductPackLevelDeclared` and\n`ProductPackLevelRetired` from the same topic feed the packaging view\n(group from env `PACKAGING_CONSUMER_GROUP`).\n`LocationSlotRegistered` and `LocationSlotDecommissioned` from\n`warehouse.facility.events` feed the `dock_doors` local copy\n(group from env `DOCK_DOOR_CONSUMER_GROUP`). The three consumers always\nrun: `PRODUCT_MODE` / `DOCK_DOOR_MODE` accept only `kafka` (or unset) and\n`permissive` / `off` are boot errors, as is an unset group variable.\n`DockAppointmentBooked` and `DockAppointmentCancelled` from\n`warehouse.dock-scheduling.events` feed the `appointments` local copy\n(group from env `DOCK_APPOINTMENT_CONSUMER_GROUP`, ADR 0019), and\n`DockAppointmentRescheduled` / `DockAppointmentDoorReassigned` keep its\ndoor and window current (ADR 0020): inbound appointments only, guarded by\ndock-scheduling's `version`; applying them publishes nothing. Receipts\nvalidate their appointment against that copy and take its door when they\nopen; an open receipt keeps its door.\n\n**Analytics (ADR 0006).** The seven events are ALSO written, in the\nsame transaction, to `warehouse.inbound-receiving.analytics` with the same\n`type` and the same `id` per occurrence, `dataschema`\n`urn:warehouse:inbound-receiving:analytics:<EventName>:v1` and payloads\nequal to the integration payloads. Only this service's `inbound-projector`\nconsumes it; it is not an integration contract. The retired\n`dockappointment` events already on that stream stay projected (ADR 0022).\n\n**Planned.** warehouse-planning reads appointments from dock-scheduling\n(companion of plan YD-0002).\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\nOptional W3C trace-context headers (`traceparent`, and `tracestate` /\n`baggage` when present) carry the trace of the request that wrote the\noutbox row (ADR 0009); consumers may extract them, and must not require\nthem.\n`specversion`, `id`, `source` (`/warehouse/inbound-receiving`), `type`,\n`subject` (the aggregate instance id), `time`, `datacontenttype`\n(`application/json`) and `dataschema`\n(`urn:warehouse:inbound-receiving:events:<EventName>:v1`) are all required.\n`type` = `com.warehouse.wms.inbound-receiving.<entity>.<EventName>` with\n`<entity>` one of `asn`, `receipt`. Kafka key:\n`asn_number` for `asn.*` and `receipt.*`. `data` is snake_case, optional fields are omitted when\nunset, timestamps are RFC 3339 UTC. A breaking payload change is a new\n`.v2` type, never a mutation.\n"
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
      "name": "inbound-receiving",
      "description": "The inbound-receiving bounded context (WMS subdomain)."
    },
    {
      "name": "asn",
      "description": "Events raised by the Asn aggregate."
    },
    {
      "name": "receipt",
      "description": "Events raised by the Receipt aggregate."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes."
    },
    {
      "name": "analytics",
      "description": "This service's own analytics stream, consumed only by its projector (ADR 0006)."
    }
  ],
  "channels": {
    "warehouse.inbound-receiving.events": {
      "description": "This service's integration topic. Written by the outbox relay; every\nmessage carries the CloudEvents content-type header (plus the optional\nW3C `traceparent` of the writing request). Key = `asn_number`\nfor ASN and receipt events. Dispatch on the full `type`, ignore unknown types, dedupe on\n`id`. The first consumer is inventory-storage (`ReceiptLineReceived`).\n",
      "subscribe": {
        "operationId": "receiveInboundReceivingEvents",
        "summary": "Receive ASN and receipt events.",
        "description": "Subscribe to the inbound dock workflow. Route on the full `type`\n(`com.warehouse.wms.inbound-receiving.<entity>.<EventName>`).\n",
        "tags": [
          {
            "name": "asn"
          },
          {
            "name": "receipt"
          }
        ],
        "message": {
          "oneOf": [
            {
              "x-no-consumer-reason": "planned warehouse-planning consumer not built (K28)",
              "name": "ASNRegistered",
              "title": "ASN registered",
              "summary": "A supplier's advance ship notice was registered.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.ASNRegistered`; subject and key = the ASN number.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "asn"
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
                        "description": "The aggregate instance id.",
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
                          "asn_number",
                          "supplier_ref",
                          "lines"
                        ],
                        "properties": {
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-11>"
                          },
                          "supplier_ref": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-12>"
                          },
                          "expected_arrival": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Omitted when the supplier gave none.",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Optional opaque tenant tag.",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "lines": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "expected_qty"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-16>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-17>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-18>"
                                }
                              },
                              "x-parser-schema-id": "AsnLineData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "cartons": {
                            "type": "array",
                            "description": "Optional announced cartons.",
                            "items": {
                              "type": "object",
                              "required": [
                                "sscc",
                                "kind",
                                "contents"
                              ],
                              "properties": {
                                "sscc": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-21>"
                                },
                                "parent_sscc": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-22>"
                                },
                                "kind": {
                                  "type": "string",
                                  "enum": [
                                    "HOMOGENEOUS_CASE",
                                    "MIXED"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-23>"
                                },
                                "gross_weight_g": {
                                  "type": "integer",
                                  "x-parser-schema-id": "<anonymous-schema-24>"
                                },
                                "dims": {
                                  "type": "object",
                                  "properties": {
                                    "length_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-26>"
                                    },
                                    "width_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-27>"
                                    },
                                    "height_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-28>"
                                    }
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-25>"
                                },
                                "contents": {
                                  "type": "array",
                                  "items": {
                                    "type": "object",
                                    "required": [
                                      "line_no",
                                      "sku",
                                      "gtin",
                                      "qty"
                                    ],
                                    "properties": {
                                      "line_no": {
                                        "type": "integer",
                                        "x-parser-schema-id": "<anonymous-schema-31>"
                                      },
                                      "sku": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-32>"
                                      },
                                      "gtin": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-33>"
                                      },
                                      "qty": {
                                        "type": "integer",
                                        "description": "Eaches.",
                                        "x-parser-schema-id": "<anonymous-schema-34>"
                                      },
                                      "lot": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-35>"
                                      },
                                      "expiry": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-36>"
                                      }
                                    },
                                    "x-parser-schema-id": "<anonymous-schema-30>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-29>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-20>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "ASNRegisteredEvent"
              },
              "examples": [
                {
                  "name": "registered",
                  "summary": "ASN-1001 with two lines.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1f3a52-0d4e-4b8a-9e61-2a5d8f0c3b14",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.ASNRegistered",
                    "subject": "ASN-1001",
                    "time": "2026-10-08T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ASNRegistered:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "supplier_ref": "ACME",
                      "expected_arrival": "2026-10-09T08:00:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "expected_qty": 40
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-2",
                          "expected_qty": 5
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "planned warehouse-planning consumer not built (K28)",
              "name": "ASNCancelled",
              "title": "ASN cancelled",
              "summary": "A Registered ASN was cancelled.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.ASNCancelled`; subject and key = the ASN number.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "asn"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "asn_number"
                        ],
                        "properties": {
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "reason": {
                            "type": "string",
                            "description": "Omitted when none was given.",
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-37>"
                  }
                ],
                "x-parser-schema-id": "ASNCancelledEvent"
              },
              "examples": [
                {
                  "name": "cancelled",
                  "summary": "ASN-1001 cancelled by the supplier.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1e9b4d70-3c2a-4f5d-8b17-6a0c9d2e7f31",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.ASNCancelled",
                    "subject": "ASN-1001",
                    "time": "2026-10-08T12:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ASNCancelled:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "reason": "Supplier cancelled the shipment"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "planned warehouse-planning consumer not built (K28)",
              "name": "ReceiptOpened",
              "title": "Receipt opened",
              "summary": "Receiving of an ASN started.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptOpened`; subject = the receipt id, key = the ASN number.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "receipt_id",
                          "asn_number",
                          "opened_at"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "description": "Omitted for a walk-in delivery.",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "door_code": {
                            "type": "string",
                            "description": "Omitted when the receipt has no appointment.",
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          },
                          "opened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-41>"
                  }
                ],
                "x-parser-schema-id": "ReceiptOpenedEvent"
              },
              "examples": [
                {
                  "name": "opened",
                  "summary": "A receipt opened from a checked-in appointment.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "d4e6f8a0-3b5c-4d7e-9f1a-2b3c4d5e6f70",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptOpened",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceiptOpened:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "opened_at": "2026-10-09T08:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptLineReceived",
              "title": "Receipt line received",
              "summary": "A quantity was received against a line (the handover event).",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived`;\nsubject = the receipt id, key = the ASN number. inventory-storage\nbooks `condition=Good` quantities with its ReceiveStock use case and\nignores `Damaged`; it dedupes on the CloudEvents `id`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "receipt_id",
                          "asn_number",
                          "line_no",
                          "sku",
                          "quantity",
                          "condition",
                          "received_at"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "condition": {
                            "type": "string",
                            "enum": [
                              "Good",
                              "Damaged"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Optional; omitted for fleet-owned stock.",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "pack_gtin": {
                            "type": "string",
                            "description": "Optional; the CASE GTIN when received as cases or from a homogeneous carton.",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "cases": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Optional; cases booked; `quantity` stays eaches.",
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Optional; the carton the quantity came from.",
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-49>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-48>"
                  }
                ],
                "x-parser-schema-id": "ReceiptLineReceivedEvent"
              },
              "examples": [
                {
                  "name": "good",
                  "summary": "40 good units of SKU-1 received.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f8f6c2e-9b1a-4d6e-8a52-0c7d1e4b9a10",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceiptLineReceived:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 40,
                      "condition": "Good",
                      "received_at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptCartonReceived",
              "title": "Receipt carton received",
              "summary": "A carton (or one case) was received - identity only.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived`;\nsubject = the receipt id, key = the ASN number.\nIDENTITY ONLY: it never books quantity (`ReceiptLineReceived` stays the\nsole quantity authority, in eaches). inventory-storage uses it to\ncreate or link a Container keyed (receipt_id, line_no, lpn), in either\narrival order. `lpn` is the SSCC, or an internal `LPN-<ulid>` for a\ncase received without one. There is no site: the site is derived by\ninventory-storage at stow (ADR 0013).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
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
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Omitted for fleet-owned stock.",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Omitted for an unlabelled carton.",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "parent_sscc": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "sealed": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "lpn": {
                            "type": "string",
                            "description": "The SSCC, or an internal `LPN-<ulid>`.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "contents": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "gtin",
                                "qty",
                                "condition"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-72>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-73>"
                                },
                                "gtin": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-74>"
                                },
                                "qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "description": "Eaches.",
                                  "x-parser-schema-id": "<anonymous-schema-75>"
                                },
                                "lot": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-76>"
                                },
                                "expiry": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-77>"
                                },
                                "condition": {
                                  "type": "string",
                                  "enum": [
                                    "Good",
                                    "Damaged"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-78>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-71>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-61>"
                  }
                ],
                "x-parser-schema-id": "ReceiptCartonReceivedEvent"
              },
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a9f6c2e-9b1a-4d6e-8a52-0c7d1e4b9a11",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceiptCartonReceived:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "sscc": "340123450000000017",
                      "sealed": true,
                      "lpn": "340123450000000017",
                      "contents": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "gtin": "13041090004824",
                          "qty": 24,
                          "condition": "Good"
                        }
                      ],
                      "received_at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "CartonDiscrepancyRaised",
              "title": "Carton discrepancy raised",
              "summary": "A finding about a physical carton.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised`;\nsubject = the receipt id, key = the ASN number.\nCarton discrepancies travel ONLY on this event; `ReceiptClosed` keeps\nits three v1 kinds. A refused scan books nothing and raises this\nevent; an accepted carton can raise it too (for example\n`UnlabelledCarton`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                            "x-parser-schema-id": "<anonymous-schema-82>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Omitted when the finding has no SSCC.",
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          },
                          "kind": {
                            "type": "string",
                            "enum": [
                              "UnexpectedCarton",
                              "MissingCarton",
                              "DuplicateSscc",
                              "UnknownGtin",
                              "CaseQtyMismatch",
                              "MixedCaseDeclaredAsCasePack",
                              "UnlabelledCarton",
                              "CartonOverLimit",
                              "MixedCartonContentMismatch"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          },
                          "expected": {
                            "type": "string",
                            "description": "A count, a SKU, or `sku:qty` / `grossWeightG:<n>` pairs (CartonOverLimit: the breached limits; MixedCartonContentMismatch: the manifest).",
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          },
                          "actual": {
                            "type": "string",
                            "description": "The counterpart of `expected`.",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-87>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-81>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-80>"
                  }
                ],
                "x-parser-schema-id": "CartonDiscrepancyRaisedEvent"
              },
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5b0a7d3f-0c2b-4e7f-9b63-1d8e2f5c0b22",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:CartonDiscrepancyRaised:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "sscc": "340123450000000017",
                      "kind": "UnexpectedCarton",
                      "at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "planned warehouse-planning consumer not built (K28)",
              "name": "ReceiptClosed",
              "title": "Receipt closed",
              "summary": "Receiving ended, with the discrepancies against the ASN.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed`;\nsubject = the receipt id, key = the ASN number. `discrepancies` is\npresent and empty when everything matched; a line can appear once per\nkind (`Short`, `Over`, `Damaged`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
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
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          },
                          "discrepancies": {
                            "type": "array",
                            "description": "Empty when everything matched.",
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "kind",
                                "expected_qty",
                                "received_qty",
                                "damaged_qty"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-94>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-95>"
                                },
                                "kind": {
                                  "type": "string",
                                  "enum": [
                                    "Short",
                                    "Over",
                                    "Damaged"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-96>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-97>"
                                },
                                "received_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "Good plus damaged.",
                                  "x-parser-schema-id": "<anonymous-schema-98>"
                                },
                                "damaged_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "x-parser-schema-id": "<anonymous-schema-99>"
                                }
                              },
                              "x-parser-schema-id": "DiscrepancyData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-88>"
                  }
                ],
                "x-parser-schema-id": "ReceiptClosedEvent"
              },
              "examples": [
                {
                  "name": "closedWithDiscrepancies",
                  "summary": "Line 1 short and with damage, line 2 over-received.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "e5f7a9b1-4c6d-4e8f-a02b-3c4d5e6f7a81",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceiptClosed:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "closed_at": "2026-10-09T09:30:00Z",
                      "discrepancies": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "kind": "Short",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "damaged_qty": 4
                        },
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "kind": "Damaged",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "damaged_qty": 4
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-2",
                          "kind": "Over",
                          "expected_qty": 5,
                          "received_qty": 7,
                          "damaged_qty": 0
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "read by this service's own analytics report; no other consumer built yet",
              "name": "ReceiptStowCompleted",
              "title": "Receipt stow completed",
              "summary": "The dock-to-stock fact of a receipt (ADR 0021).",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptStowCompleted`;\nsubject = the receipt id, key = the ASN number. Raised exactly once,\nfor a Closed receipt opened from an appointment, when every Good\ncarton has a stow from inventory-storage and the gate arrival from\nyard-management is known, whatever order those facts and the close\narrive in. `dock_to_stock_seconds` is `stowed_at - arrived_at` in\nwhole seconds, never negative; `stowed_at` is the latest stow of a\nGood carton and `carton_count` how many Good cartons that is. `At`\n(the CloudEvents `time`) is when the completion was observed.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "receipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "receipt_id",
                          "asn_number",
                          "appointment_id",
                          "arrived_at",
                          "closed_at",
                          "stowed_at",
                          "dock_to_stock_seconds",
                          "carton_count"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-102>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-103>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-104>"
                          },
                          "arrived_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "yard-management's gate arrival.",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "stowed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The latest stow of a Good carton.",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "dock_to_stock_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 0,
                            "description": "stowed_at - arrived_at, clamped at 0.",
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "carton_count": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "How many Good cartons were stowed.",
                            "x-parser-schema-id": "<anonymous-schema-109>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-101>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-100>"
                  }
                ],
                "x-parser-schema-id": "ReceiptStowCompletedEvent"
              },
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a3b5c7d-1e2f-4a8b-b6c4-0d1e2f3a4b55",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptStowCompleted",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T07:00:01Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceiptStowCompleted:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "arrived_at": "2026-10-09T05:00:00Z",
                      "closed_at": "2026-10-09T06:30:00Z",
                      "stowed_at": "2026-10-09T07:00:00Z",
                      "dock_to_stock_seconds": 7200,
                      "carton_count": 12
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.inbound-receiving.analytics": {
      "description": "This service's analytics topic (`AnalyticsTopic` in\n`internal/adapters/outbound/kafka/analytics_encoder.go`; ADR 0006).\nWritten by the SAME outbox relay, from rows inserted in the same\ntransaction as the integration rows (one CloudEvents `id` per occurrence\non both topics); key as on the integration topic. Consumed ONLY by this\nservice's `inbound-projector` under a fixed consumer group read from env\n`ANALYTICS_CONSUMER_GROUP` (at-least-once; the offset is committed after\nthe projection and the dedupe mark committed together in the analytical\ndatabase). The projector dedupes on `id`, ignores unknown types, skips\n(with a rate-limited WARN) anything that is not CloudEvents 1.0, and\ndead-letters a known type with an unusable payload to\n`warehouse.inbound-receiving.analytics.dlq` (raw bytes plus `x-dlq-*`\nheaders). Not an integration contract: other contexts consume\n`warehouse.inbound-receiving.events`.\n",
      "subscribe": {
        "operationId": "receiveInboundReceivingAnalyticsEvents",
        "summary": "Receive the inbound-receiving analytics events.",
        "description": "Route on the full `type`; the payloads equal the integration payloads\n(no analytics-only fields in v1). `dataschema` is\n`urn:warehouse:inbound-receiving:analytics:<EventName>:v1`.\n",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ASNRegistered",
              "title": "ASN registered (analytics)",
              "summary": "A supplier's advance ship notice was registered, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.ASNRegistered` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ASNRegistered:v1`; payload equal to the integration payload.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1f3a52-0d4e-4b8a-9e61-2a5d8f0c3b14",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.ASNRegistered",
                    "subject": "ASN-1001",
                    "time": "2026-10-08T12:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ASNRegistered:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "supplier_ref": "ACME",
                      "expected_arrival": "2026-10-09T08:00:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "expected_qty": 40
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-2",
                          "expected_qty": 5
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ASNCancelled",
              "title": "ASN cancelled (analytics)",
              "summary": "A Registered ASN was cancelled, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.ASNCancelled` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ASNCancelled:v1`; payload equal to the integration payload.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1e9b4d70-3c2a-4f5d-8b17-6a0c9d2e7f31",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.ASNCancelled",
                    "subject": "ASN-1001",
                    "time": "2026-10-08T12:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ASNCancelled:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "reason": "Supplier cancelled the shipment"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptOpened",
              "title": "Receipt opened (analytics)",
              "summary": "Receiving of an ASN started, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptOpened` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceiptOpened:v1`; payload equal to the integration payload.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "d4e6f8a0-3b5c-4d7e-9f1a-2b3c4d5e6f70",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptOpened",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceiptOpened:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "opened_at": "2026-10-09T08:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptLineReceived",
              "title": "Receipt line received (analytics)",
              "summary": "A quantity was received against a line (the handover event), on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceiptLineReceived:v1`; payload equal to the integration payload.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f8f6c2e-9b1a-4d6e-8a52-0c7d1e4b9a10",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptLineReceived",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceiptLineReceived:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 40,
                      "condition": "Good",
                      "received_at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptCartonReceived",
              "title": "Receipt carton received",
              "summary": "A carton (or one case) was received - identity only.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived`;\nsubject = the receipt id, key = the ASN number. Same payload as on the integration topic; dataschema `urn:warehouse:inbound-receiving:analytics:ReceiptCartonReceived:v1`.\nIDENTITY ONLY: it never books quantity (`ReceiptLineReceived` stays the\nsole quantity authority, in eaches). inventory-storage uses it to\ncreate or link a Container keyed (receipt_id, line_no, lpn), in either\narrival order. `lpn` is the SSCC, or an internal `LPN-<ulid>` for a\ncase received without one. There is no site: the site is derived by\ninventory-storage at stow (ADR 0013).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4].payload",
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a9f6c2e-9b1a-4d6e-8a52-0c7d1e4b9a11",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptCartonReceived",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceiptCartonReceived:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "sscc": "340123450000000017",
                      "sealed": true,
                      "lpn": "340123450000000017",
                      "contents": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "gtin": "13041090004824",
                          "qty": 24,
                          "condition": "Good"
                        }
                      ],
                      "received_at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "CartonDiscrepancyRaised",
              "title": "Carton discrepancy raised",
              "summary": "A finding about a physical carton.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised`;\nsubject = the receipt id, key = the ASN number. Same payload as on the integration topic; dataschema `urn:warehouse:inbound-receiving:analytics:CartonDiscrepancyRaised:v1`.\nCarton discrepancies travel ONLY on this event; `ReceiptClosed` keeps\nits three v1 kinds. A refused scan books nothing and raises this\nevent; an accepted carton can raise it too (for example\n`UnlabelledCarton`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5].payload",
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5b0a7d3f-0c2b-4e7f-9b63-1d8e2f5c0b22",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.CartonDiscrepancyRaised",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T08:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:CartonDiscrepancyRaised:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "sscc": "340123450000000017",
                      "kind": "UnexpectedCarton",
                      "at": "2026-10-09T08:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptClosed",
              "title": "Receipt closed (analytics)",
              "summary": "Receiving ended, with the discrepancies against the ASN, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceiptClosed:v1`; payload equal to the integration payload.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "e5f7a9b1-4c6d-4e8f-a02b-3c4d5e6f7a81",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceiptClosed:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "closed_at": "2026-10-09T09:30:00Z",
                      "discrepancies": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "kind": "Short",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "damaged_qty": 4
                        },
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "kind": "Damaged",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "damaged_qty": 4
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-2",
                          "kind": "Over",
                          "expected_qty": 5,
                          "received_qty": 7,
                          "damaged_qty": 0
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceiptStowCompleted",
              "title": "Receipt stow completed (analytics)",
              "summary": "The dock-to-stock fact of a receipt, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptStowCompleted` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceiptStowCompleted:v1`; payload equal to the integration payload. The projector folds it into `dock_to_stock_facts`, one row per receipt.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a3b5c7d-1e2f-4a8b-b6c4-0d1e2f3a4b55",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceiptStowCompleted",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T07:00:01Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceiptStowCompleted:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "arrived_at": "2026-10-09T05:00:00Z",
                      "closed_at": "2026-10-09T06:30:00Z",
                      "stowed_at": "2026-10-09T07:00:00Z",
                      "dock_to_stock_seconds": 7200,
                      "carton_count": 12
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
      "description": "product-master's integration topic. `ProductRegistered` feeds the\n`known_skus` local copy (ADR 0003, group from env `PRODUCT_CONSUMER_GROUP`,\nalways running); `ProductPackLevelDeclared` and\n`ProductPackLevelRetired` feed the packaging view (group from env\n`PACKAGING_CONSUMER_GROUP`). Every other type on the topic is ignored.\n",
      "publish": {
        "operationId": "consumeProductRegistered",
        "summary": "Consume product-master's ProductRegistered.",
        "description": "Upserts the SKU into `known_skus`. The CloudEvents `id` claim and the\neffect commit in one transaction; the offset is committed afterwards.\nAnything that is not a valid CloudEvent is skipped with a WARN.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProductRegistered",
              "title": "product-master ProductRegistered (consumed)",
              "summary": "A SKU was registered as a product.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductRegistered`,\nsource `/warehouse/product-master`, dataschema\n`urn:warehouse:product-master:events:ProductRegistered:v1`; subject and\nkey = the SKU. Produced by product-master; verified against its\n`origin/develop` contract on 2026-10-08.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "sku",
                          "description",
                          "version"
                        ],
                        "properties": {
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-112>"
                          },
                          "description": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-113>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-114>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-110>"
                  }
                ],
                "x-parser-schema-id": "ProductRegisteredEvent"
              },
              "examples": [
                {
                  "name": "registered",
                  "summary": "SKU-1 registered.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1b0c9a4e-2f7d-4a63-9d1e-5a7c3e2b9f10",
                    "source": "/warehouse/product-master",
                    "type": "com.warehouse.wms.product-master.product.ProductRegistered",
                    "subject": "SKU-1",
                    "time": "2026-10-06T21:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:product-master:events:ProductRegistered:v1",
                    "data": {
                      "sku": "SKU-1",
                      "description": "Lithium battery pack 12V",
                      "version": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "ProductPackLevelDeclared",
              "title": "product-master ProductPackLevelDeclared (consumed)",
              "summary": "A pack level (EACH, INNER, CASE or PALLET) of a SKU was declared, or one of its mutable attributes changed.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductPackLevelDeclared`,\nsource `/warehouse/product-master`, dataschema\n`urn:warehouse:product-master:events:ProductPackLevelDeclared:v1`; subject and\nkey = the SKU. Produced by product-master; consumed into the local\npackaging view (pack level -> eaches factor for case-level scans).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
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
                            "x-parser-schema-id": "<anonymous-schema-117>"
                          },
                          "level": {
                            "type": "string",
                            "enum": [
                              "EACH",
                              "INNER",
                              "CASE",
                              "PALLET"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-118>"
                          },
                          "gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-119>"
                          },
                          "child_gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-120>"
                          },
                          "qty_of_child": {
                            "type": "integer",
                            "minimum": 2,
                            "maximum": 1000000,
                            "description": "Absent for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-121>"
                          },
                          "units_per_pack": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 1000000,
                            "description": "Direct factor to eaches; 1 for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-122>"
                          },
                          "is_orderable": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-123>"
                          },
                          "is_despatch_unit": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-124>"
                          },
                          "effective_from": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-125>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-116>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-115>"
                  }
                ],
                "x-parser-schema-id": "ProductPackLevelDeclaredEvent"
              }
            },
            {
              "name": "ProductPackLevelRetired",
              "title": "product-master ProductPackLevelRetired (consumed)",
              "summary": "A pack level of a SKU was retired.",
              "description": "`type` = `com.warehouse.wms.product-master.product.ProductPackLevelRetired`,\nsource `/warehouse/product-master`, dataschema\n`urn:warehouse:product-master:events:ProductPackLevelRetired:v1`; subject and\nkey = the SKU. Produced by product-master; consumed into the local\npackaging view (retired levels are no longer valid scan targets).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
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
                            "x-parser-schema-id": "<anonymous-schema-129>"
                          },
                          "level": {
                            "type": "string",
                            "enum": [
                              "EACH",
                              "INNER",
                              "CASE",
                              "PALLET"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-130>"
                          },
                          "gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-131>"
                          },
                          "effective_to": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "reason": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 200,
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-128>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-127>"
                  }
                ],
                "x-parser-schema-id": "ProductPackLevelRetiredEvent"
              }
            }
          ]
        }
      }
    },
    "warehouse.facility.events": {
      "description": "facility-layout's integration topic. Consumed ONLY for\n`LocationSlotRegistered` and `LocationSlotDecommissioned` (ADR 0003),\ninto the `dock_doors` local copy, with a stable consumer group read from\nenv `DOCK_DOOR_CONSUMER_GROUP`; the consumer always runs. Every other type on the topic is ignored. Key =\n`locationCode`.\n",
      "publish": {
        "operationId": "consumeDockDoorEvents",
        "summary": "Consume facility-layout's slot registrations and decommissions.",
        "description": "A registration with `role=Dock` and `dockFlow` of `Inbound` or `Both`\nupserts a door; any other registration is ignored. A decommission\ndeletes the door of that `locationCode` (a no-op for any other slot).\nThe CloudEvents `id` claim and the effect commit in one transaction;\nthe offset is committed afterwards.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "LocationSlotRegistered",
              "title": "facility-layout LocationSlotRegistered (consumed)",
              "summary": "A coded slot now exists on the warehouse map.",
              "description": "`type` = `com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered`,\nsource `/warehouse/facility-layout`, dataschema\n`urn:warehouse:facility-layout:events:LocationSlotRegistered:v1`; key =\n`locationCode`. `data` is camelCase and carries the domain event\nverbatim (`eventName`, `eventType`, `occurredAt` included). An absent\n`role` means `Storage`; `dockFlow` is present only for `role=Dock`.\nOnly `role=Dock` with `dockFlow` `Inbound` or `Both` is kept.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "locationCode",
                          "aisleId",
                          "zoneId",
                          "locationType",
                          "maxWeightKg",
                          "maxVolumeM3"
                        ],
                        "properties": {
                          "eventName": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-137>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-138>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-139>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          },
                          "aisleId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          },
                          "zoneId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-142>"
                          },
                          "locationType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          },
                          "role": {
                            "type": "string",
                            "description": "Storage, Dock, Yard, WorkCenter, Drop, Staging, QC, Consolidation or Shipping; absent means Storage.",
                            "x-parser-schema-id": "<anonymous-schema-144>"
                          },
                          "dockFlow": {
                            "type": "string",
                            "enum": [
                              "Inbound",
                              "Outbound",
                              "Both"
                            ],
                            "description": "Present only when role is Dock.",
                            "x-parser-schema-id": "<anonymous-schema-145>"
                          },
                          "activities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-147>"
                            },
                            "description": "Present only when role is WorkCenter.",
                            "x-parser-schema-id": "<anonymous-schema-146>"
                          },
                          "maxWeightKg": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-148>"
                          },
                          "maxVolumeM3": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-149>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-136>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-135>"
                  }
                ],
                "x-parser-schema-id": "LocationSlotRegisteredEvent"
              },
              "examples": [
                {
                  "name": "inboundDock",
                  "summary": "An inbound dock door.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                    "subject": "WH1-DOCK-IN-01",
                    "time": "2026-10-01T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:LocationSlotRegistered:v1",
                    "data": {
                      "eventName": "LocationSlotRegistered",
                      "eventType": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                      "occurredAt": "2026-10-01T10:00:00Z",
                      "locationCode": "WH1-DOCK-IN-01",
                      "aisleId": "WH1-DOCK-A01",
                      "zoneId": "WH1-DOCK-AMB",
                      "locationType": "DockDoor",
                      "role": "Dock",
                      "dockFlow": "Inbound",
                      "maxWeightKg": 0,
                      "maxVolumeM3": 0
                    }
                  }
                }
              ]
            },
            {
              "name": "LocationSlotDecommissioned",
              "title": "facility-layout LocationSlotDecommissioned (consumed)",
              "summary": "A coded slot was permanently retired.",
              "description": "`type` = `com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned`,\nsource `/warehouse/facility-layout`, dataschema\n`urn:warehouse:facility-layout:events:LocationSlotDecommissioned:v1`;\nkey = `locationCode`. Removes the door from the local copy when the\ncode is one.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "locationCode"
                        ],
                        "properties": {
                          "eventName": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-152>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-153>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-154>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-155>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-151>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-150>"
                  }
                ],
                "x-parser-schema-id": "LocationSlotDecommissionedEvent"
              },
              "examples": [
                {
                  "name": "decommissioned",
                  "summary": "The door was retired.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7b8c9d0e-1f2a-4b3c-9d4e-5f6a7b8c9d0e",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned",
                    "subject": "WH1-DOCK-IN-01",
                    "time": "2026-10-05T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:LocationSlotDecommissioned:v1",
                    "data": {
                      "eventName": "LocationSlotDecommissioned",
                      "eventType": "com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned",
                      "occurredAt": "2026-10-05T10:00:00Z",
                      "locationCode": "WH1-DOCK-IN-01"
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.dock-scheduling.events": {
      "description": "dock-scheduling's integration topic (ADR 0019, 0020, plan YD-0002).\nConsumed ONLY for `DockAppointmentBooked`, `DockAppointmentCancelled`,\n`DockAppointmentRescheduled` and `DockAppointmentDoorReassigned`, into\nthe `appointments` local copy, with a stable consumer group read from\nenv `DOCK_APPOINTMENT_CONSUMER_GROUP`; the consumer always runs. Every\nother type on the topic (`DockAppointmentNoShow`, check-in, door\nclosures, ...) is committed past untouched. Key = `appointment_id`.\n`DockAppointmentDoorReassigned` may not be published on this topic yet;\nthe consumer does not depend on it arriving.\n",
      "publish": {
        "operationId": "consumeDockAppointmentEvents",
        "summary": "Consume dock-scheduling's appointment bookings, cancellations, reschedules and door reassignments.",
        "description": "A `DockAppointmentBooked` with `direction=INBOUND` upserts the\nappointment (door, carrier, window, ASN numbers); an `OUTBOUND` one is\nignored. A `DockAppointmentCancelled` marks the stored appointment\ncancelled. A `DockAppointmentRescheduled` moves the stored\nappointment's door and window; a `DockAppointmentDoorReassigned` moves\nits door (ADR 0020). All four are guarded by `version`: an event is\napplied only if its `version` is greater than the stored one (a legacy\nrow has version 0, so any dock-scheduling version wins), and no later\nevent revives a cancelled appointment. A reschedule or reassignment\nof an appointment that is not in the copy (an `OUTBOUND` one, or one\nnot seen yet) is ignored and logged at DEBUG. Receipts already open\nkeep their door; receipts opened afterwards take the new one. The\nCloudEvents `id` claim and the effect commit in one transaction; the\noffset is committed afterwards. NO-LOOP: applying an event writes\nnothing to the outbox. A payload that breaks a rule of this context\nis skipped with a WARN, a transient error is retried.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "DockAppointmentBooked",
              "title": "dock-scheduling DockAppointmentBooked (consumed)",
              "summary": "dock-scheduling booked (or imported) a dock appointment.",
              "description": "`type` = `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked`,\nsource `/warehouse/dock-scheduling`; key and subject = `appointment_id`.\n`data` is snake_case. Only the fields in the schema are read; the rest\nof dock-scheduling's payload (`site_id`, `carrier_scac`, `cpt_id`,\n`shipment_refs`, `expected_seal_number`, `provenance`,\n`arrival_tolerance_minutes`, ...) is ignored.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "description": "The fields this service reads; others are ignored.",
                        "required": [
                          "appointment_id",
                          "direction",
                          "door_code",
                          "carrier",
                          "window_start",
                          "window_end",
                          "version"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-158>"
                          },
                          "direction": {
                            "type": "string",
                            "enum": [
                              "INBOUND",
                              "OUTBOUND"
                            ],
                            "description": "Only INBOUND is copied.",
                            "x-parser-schema-id": "<anonymous-schema-159>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-160>"
                          },
                          "carrier": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-161>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-162>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-163>"
                          },
                          "asn_numbers": {
                            "type": "array",
                            "description": "At least one for an INBOUND appointment.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-165>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-164>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "dock-scheduling's aggregate version; the version guard of the copy.",
                            "x-parser-schema-id": "<anonymous-schema-166>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-157>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  }
                ],
                "x-parser-schema-id": "DockSchedulingAppointmentBookedEvent"
              },
              "examples": [
                {
                  "name": "inbound",
                  "summary": "An inbound appointment covering ASN-1001.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "0b6d1c4e-7a2f-4d83-9e15-3c8a5f7b9d21",
                    "source": "/warehouse/dock-scheduling",
                    "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-08T12:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentBooked:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "site_id": "WH1",
                      "direction": "INBOUND",
                      "door_code": "WH1-DOCK-IN-01",
                      "carrier": "ACME Freight",
                      "carrier_scac": "ACMF",
                      "window_start": "2026-10-09T08:00:00Z",
                      "window_end": "2026-10-09T10:00:00Z",
                      "asn_numbers": [
                        "ASN-1001"
                      ],
                      "shipment_refs": [],
                      "provenance": "native",
                      "version": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentCancelled",
              "title": "dock-scheduling DockAppointmentCancelled (consumed)",
              "summary": "dock-scheduling cancelled a dock appointment.",
              "description": "`type` = `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCancelled`,\nsource `/warehouse/dock-scheduling`; key and subject = `appointment_id`.\nOnly `appointment_id` and `version` are read.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "description": "The fields this service reads; others are ignored.",
                        "required": [
                          "appointment_id",
                          "version"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-169>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-170>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-168>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-167>"
                  }
                ],
                "x-parser-schema-id": "DockSchedulingAppointmentCancelledEvent"
              },
              "examples": [
                {
                  "name": "cancelled",
                  "summary": "The carrier asked to cancel.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5e9a3b7c-1d4f-4a60-8b2e-7c0d9f1a3e45",
                    "source": "/warehouse/dock-scheduling",
                    "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentCancelled",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-08T13:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentCancelled:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "site_id": "WH1",
                      "door_code": "WH1-DOCK-IN-01",
                      "reason": "CARRIER_REQUEST",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentRescheduled",
              "title": "dock-scheduling DockAppointmentRescheduled (consumed)",
              "summary": "dock-scheduling moved a dock appointment to a new window and possibly a new door.",
              "description": "`type` = `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentRescheduled`,\nsource `/warehouse/dock-scheduling`; key and subject = `appointment_id`.\n`data` is snake_case. The copy takes `door_code`, `window_start` and\n`window_end` at `version` (ADR 0020); `previous_door_code` is logged,\nand `site_id`, `previous_window_*` and `arrival_tolerance_minutes` are\nignored. Receipts already open keep their door.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "description": "dock-scheduling's payload; only `appointment_id`, `door_code`, `window_start`, `window_end` and `version` change the copy.",
                        "required": [
                          "appointment_id",
                          "door_code",
                          "window_start",
                          "window_end",
                          "version"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-173>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-174>"
                          },
                          "door_code": {
                            "type": "string",
                            "description": "The new door.",
                            "x-parser-schema-id": "<anonymous-schema-175>"
                          },
                          "previous_door_code": {
                            "type": "string",
                            "description": "Logged only.",
                            "x-parser-schema-id": "<anonymous-schema-176>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-177>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Must be after `window_start`.",
                            "x-parser-schema-id": "<anonymous-schema-178>"
                          },
                          "previous_window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-179>"
                          },
                          "previous_window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-180>"
                          },
                          "arrival_tolerance_minutes": {
                            "type": "integer",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-181>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "dock-scheduling's aggregate version; the version guard of the copy.",
                            "x-parser-schema-id": "<anonymous-schema-182>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-172>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-171>"
                  }
                ],
                "x-parser-schema-id": "DockSchedulingAppointmentRescheduledEvent"
              },
              "examples": [
                {
                  "name": "rescheduled",
                  "summary": "The carrier is two hours late and is moved to another door.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8c2f4a1e-3b5d-4e7f-9a60-1d2c3b4a5e6f",
                    "source": "/warehouse/dock-scheduling",
                    "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentRescheduled",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T07:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentRescheduled:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "site_id": "WH1",
                      "door_code": "WH1-DOCK-IN-03",
                      "previous_door_code": "WH1-DOCK-IN-01",
                      "window_start": "2026-10-09T10:00:00Z",
                      "window_end": "2026-10-09T12:00:00Z",
                      "previous_window_start": "2026-10-09T08:00:00Z",
                      "previous_window_end": "2026-10-09T10:00:00Z",
                      "arrival_tolerance_minutes": 15,
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentDoorReassigned",
              "title": "dock-scheduling DockAppointmentDoorReassigned (consumed)",
              "summary": "The appointment's door was reassigned (the window is unchanged).",
              "description": "`type` = `com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentDoorReassigned`,\nsource `/warehouse/dock-scheduling`; key and subject = `appointment_id`.\nThe copy takes `to_door_code` at `version` (ADR 0020);\n`from_door_code` is logged, not checked. dock-scheduling is moving this\ntype onto its integration topic; until then it never arrives and the\nconsumer does not depend on it. Receipts already open keep their door.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "description": "dock-scheduling's payload; only `appointment_id`, `to_door_code` and `version` change the copy.",
                        "required": [
                          "appointment_id",
                          "to_door_code",
                          "version"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-185>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-186>"
                          },
                          "from_door_code": {
                            "type": "string",
                            "description": "Logged only.",
                            "x-parser-schema-id": "<anonymous-schema-187>"
                          },
                          "to_door_code": {
                            "type": "string",
                            "description": "The new door.",
                            "x-parser-schema-id": "<anonymous-schema-188>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-189>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-184>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-183>"
                  }
                ],
                "x-parser-schema-id": "DockSchedulingAppointmentDoorReassignedEvent"
              },
              "examples": [
                {
                  "name": "reassigned",
                  "summary": "The booked door is blocked; the yard sends the truck to door 04.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2a7e9c4b-6d1f-4b38-8e25-9f0a1b2c3d4e",
                    "source": "/warehouse/dock-scheduling",
                    "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentDoorReassigned",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T07:50:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentDoorReassigned:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "site_id": "WH1",
                      "from_door_code": "WH1-DOCK-IN-01",
                      "to_door_code": "WH1-DOCK-IN-04",
                      "version": 3
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.yard-management.events": {
      "description": "yard-management's integration topic (ADR 0021). Consumed ONLY for\n`VisitCheckedIn`, into the `visit_arrivals` local copy, with a stable\nconsumer group read from env `VISIT_ARRIVAL_CONSUMER_GROUP`; the\nconsumer always runs. Every other type on the topic (`VisitRejected`,\n`TrailerDocked`, `TrailerDeparted`, ...) is committed past untouched.\nKey = `visit_id`.\n",
      "publish": {
        "operationId": "consumeYardVisitEvents",
        "summary": "Consume yard-management's gate arrivals.",
        "description": "A `VisitCheckedIn` carrying an `appointment_id` stores the earliest\n`arrived_at` seen for that appointment (idempotent, order-independent;\na redelivery or a later duplicate never moves it). A walk-in visit\n(`appointment_id` null) is ignored: there is no receipt to join it\nto. After storing, the use case evaluates the dock-to-stock fact of\nthe receipt opened from that appointment (ADR 0021) and may raise\n`ReceiptStowCompleted` through this service's outbox, never anything\ntowards yard-management. The CloudEvents `id` claim and the effect\ncommit in one transaction; the offset is committed afterwards. A\npayload that breaks a rule of this context is skipped with a WARN, a\ntransient error is retried.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "VisitCheckedIn",
          "title": "yard-management VisitCheckedIn (consumed)",
          "summary": "A carrier physically arrived at the gate.",
          "description": "`type` = `com.warehouse.wms.yard-management.yardvisit.VisitCheckedIn`,\nsource `/warehouse/yard-management`. `data` is snake_case. Only the\nfields in the schema are read; the rest of yard-management's payload\n(`site_id`, `carrier`, `carrier_scac`, `purpose`, `trailers`, ...) is\nignored.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; others are ignored.",
                    "required": [
                      "visit_id",
                      "arrived_at",
                      "version"
                    ],
                    "properties": {
                      "visit_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-192>"
                      },
                      "appointment_id": {
                        "type": [
                          "string",
                          "null"
                        ],
                        "description": "Null for a walk-in visit, which is ignored.",
                        "x-parser-schema-id": "<anonymous-schema-193>"
                      },
                      "arrived_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The gate arrival: the start of dock-to-stock.",
                        "x-parser-schema-id": "<anonymous-schema-194>"
                      },
                      "version": {
                        "type": "integer",
                        "format": "int64",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-195>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-191>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-190>"
              }
            ],
            "x-parser-schema-id": "VisitCheckedInEvent"
          },
          "examples": [
            {
              "name": "scheduled",
              "payload": {
                "specversion": "1.0",
                "id": "7d1c9e2a-3b4f-4a60-8c15-9e2f0a1b3c44",
                "source": "/warehouse/yard-management",
                "type": "com.warehouse.wms.yard-management.yardvisit.VisitCheckedIn",
                "subject": "visit-5b1f0c3e",
                "time": "2026-10-09T05:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:yard-management:events:VisitCheckedIn:v1",
                "data": {
                  "visit_id": "visit-5b1f0c3e",
                  "site_id": "WH1",
                  "purpose": "LIVE_UNLOAD",
                  "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                  "arrived_at": "2026-10-09T05:00:00Z",
                  "version": 1
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.inventory.events": {
      "description": "inventory-storage's integration topic (ADR 0021). Consumed ONLY for\n`ContainerStowed`, into the `carton_stows` local copy, with a stable\nconsumer group read from env `CARTON_STOW_CONSUMER_GROUP`; the consumer\nalways runs. Every other type on the topic (`ItemStowed`, which has no\nlicense plate and so cannot be joined to a carton, `CaseBroken`, ...)\nis committed past untouched. Key and subject of `ContainerStowed` = the\nLPN.\n",
      "publish": {
        "operationId": "consumeInventoryContainerStowed",
        "summary": "Consume inventory-storage's container stows.",
        "description": "A `ContainerStowed` stores the earliest `at` seen for its `lpn`\n(idempotent, order-independent: a later move of the container to\nanother bin is not a new stow). A receipt carton is joined to it by\nits SSCC, which is the `lpn`. After storing, the use case evaluates\nthe dock-to-stock fact of the receipts holding that carton (ADR 0021)\nand may raise `ReceiptStowCompleted` through this service's outbox,\nnever anything towards inventory-storage. Claim, effect and offset\nfollow the same rules as the dock-scheduling consumer.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "ContainerStowed",
          "title": "inventory-storage ContainerStowed (consumed)",
          "summary": "A container (license plate) was put away into a bin.",
          "description": "`type` = `com.warehouse.wms.inventory-storage.container.ContainerStowed`,\nsource `/warehouse/inventory-storage`. `data` is snake_case. Only\n`lpn` and `at` are read; the rest (`sku`, `qty_eaches`, `owner_ref`,\n`site_id`, `bin`) is ignored.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "description": "The fields this service reads; others are ignored.",
                    "required": [
                      "lpn",
                      "at"
                    ],
                    "properties": {
                      "lpn": {
                        "type": "string",
                        "description": "The license plate; for a receipt carton it is its SSCC.",
                        "x-parser-schema-id": "<anonymous-schema-198>"
                      },
                      "at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the container was stowed.",
                        "x-parser-schema-id": "<anonymous-schema-199>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-197>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-196>"
              }
            ],
            "x-parser-schema-id": "ContainerStowedEvent"
          },
          "examples": [
            {
              "name": "stowed",
              "payload": {
                "specversion": "1.0",
                "id": "2c8e4f6a-91b0-4d37-a5e2-6b7c8d9e0f11",
                "source": "/warehouse/inventory-storage",
                "type": "com.warehouse.wms.inventory-storage.container.ContainerStowed",
                "subject": "340123450000000017",
                "time": "2026-10-09T07:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:inventory-storage:events:ContainerStowed:v1",
                "data": {
                  "lpn": "340123450000000017",
                  "sku": "SKU-1",
                  "qty_eaches": 20,
                  "site_id": "WH1",
                  "bin": "WH1-STOR-A01",
                  "at": "2026-10-09T07:00:00Z"
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
      "DockSchedulingAppointmentBooked": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[0]",
      "DockSchedulingAppointmentCancelled": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[1]",
      "DockSchedulingAppointmentRescheduled": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[2]",
      "DockSchedulingAppointmentDoorReassigned": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[3]",
      "ASNRegistered": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0]",
      "ASNCancelled": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1]",
      "ReceiptOpened": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2]",
      "ReceiptLineReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3]",
      "ReceiptCartonReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4]",
      "CartonDiscrepancyRaised": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5]",
      "ReceiptClosed": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6]",
      "VisitCheckedIn": "$ref:$.channels.warehouse.yard-management.events.publish.message",
      "ContainerStowed": "$ref:$.channels.warehouse.inventory.events.publish.message",
      "ReceiptStowCompleted": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7]",
      "ReceiptStowCompletedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[7]",
      "ASNRegisteredAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[0]",
      "ASNCancelledAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[1]",
      "ReceiptOpenedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[2]",
      "ReceiptLineReceivedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[3]",
      "ReceiptCartonReceivedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[4]",
      "CartonDiscrepancyRaisedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[5]",
      "ReceiptClosedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[6]",
      "ProductRegistered": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[0]",
      "ProductPackLevelDeclared": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[1]",
      "ProductPackLevelRetired": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[2]",
      "LocationSlotRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0]",
      "LocationSlotDecommissioned": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "AsnLineData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
      "DiscrepancyData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload.allOf[1].properties.data.properties.discrepancies.items",
      "ASNRegisteredEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload",
      "ASNCancelledEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1].payload",
      "DockSchedulingAppointmentBookedEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[0].payload",
      "DockSchedulingAppointmentCancelledEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[1].payload",
      "DockSchedulingAppointmentRescheduledEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[2].payload",
      "DockSchedulingAppointmentDoorReassignedEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[3].payload",
      "ReceiptOpenedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2].payload",
      "ReceiptLineReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3].payload",
      "ReceiptCartonReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4].payload",
      "CartonDiscrepancyRaisedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5].payload",
      "ReceiptClosedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload",
      "VisitCheckedInEvent": "$ref:$.channels.warehouse.yard-management.events.publish.message.payload",
      "ContainerStowedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.payload",
      "ReceiptStowCompletedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload",
      "ProductRegisteredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[0].payload",
      "ProductPackLevelDeclaredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[1].payload",
      "ProductPackLevelRetiredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[2].payload",
      "LocationSlotRegisteredEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0].payload",
      "LocationSlotDecommissionedEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1].payload"
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
  