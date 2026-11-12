
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
    "description": "Event catalog for the **inbound-receiving** bounded context (WMS subdomain):\nthe inbound dock workflow of ASNs, dock appointments and receipts\n(ADR 0001, ADR 0002).\n\n**Published.** The `Asn` and `Receipt` aggregates raise eight events,\npublished to `warehouse.inbound-receiving.events` through a\n**transactional outbox**: the aggregate row and its already-encoded events\nare written in ONE database transaction and a relay drains them to Kafka\n(at-least-once; the CloudEvents `id` is stored with the outbox row, so a\nretry republishes the same `id`). Consumers dedupe on `id`.\nThe four `dockappointment` types (Booked, CheckedIn, Cancelled, Completed)\nare **RETIRED**: the DockAppointment moved to dock-scheduling (ADR 0019,\nplan YD-0002), the backfill command that republished them is gone and\nthis service raises none (ADR 0022), so they are no longer declared. Read\ndock-scheduling's events instead.\n`ReceiptLineReceived` is the **handover event**: inventory-storage consumes\nit and books `condition=Good` quantities into stock (ADR 0003); Damaged\nquantities are recorded here and not booked.\n\n**Consumed (ADR 0003).** `ProductRegistered` from\n`warehouse.product-master.events` feeds the `known_skus` local copy\n(group from env `PRODUCT_CONSUMER_GROUP`); `ProductPackLevelDeclared` and\n`ProductPackLevelRetired` from the same topic feed the packaging view\n(group from env `PACKAGING_CONSUMER_GROUP`).\n`LocationSlotRegistered` and `LocationSlotDecommissioned` from\n`warehouse.facility.events` feed the `dock_doors` local copy\n(group from env `DOCK_DOOR_CONSUMER_GROUP`). The three consumers always\nrun: `PRODUCT_MODE` / `DOCK_DOOR_MODE` accept only `kafka` (or unset) and\n`permissive` / `off` are boot errors, as is an unset group variable.\n`DockAppointmentBooked` and `DockAppointmentCancelled` from\n`warehouse.dock-scheduling.events` feed the `appointments` local copy\n(group from env `DOCK_APPOINTMENT_CONSUMER_GROUP`, ADR 0019), and\n`DockAppointmentRescheduled` / `DockAppointmentDoorReassigned` keep its\ndoor and window current (ADR 0020): inbound appointments only, guarded by\ndock-scheduling's `version`; applying them publishes nothing. Receipts\nvalidate their appointment against that copy and take its door when they\nopen; an open receipt keeps its door.\n\n**Analytics (ADR 0006).** The eleven events are ALSO written, in the\nsame transaction, to `warehouse.inbound-receiving.analytics` with the same\n`type` and the same `id` per occurrence, `dataschema`\n`urn:warehouse:inbound-receiving:analytics:<EventName>:v1` and payloads\nequal to the integration payloads. Only this service's `inbound-projector`\nconsumes it; it is not an integration contract. The retired\n`dockappointment` events already on that stream stay projected (ADR 0022).\n\n**Planned.** warehouse-planning reads appointments from dock-scheduling\n(companion of plan YD-0002).\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\nOptional W3C trace-context headers (`traceparent`, and `tracestate` /\n`baggage` when present) carry the trace of the request that wrote the\noutbox row (ADR 0009); consumers may extract them, and must not require\nthem.\n`specversion`, `id`, `source` (`/warehouse/inbound-receiving`), `type`,\n`subject` (the aggregate instance id), `time`, `datacontenttype`\n(`application/json`) and `dataschema`\n(`urn:warehouse:inbound-receiving:events:<EventName>:v1`) are all required.\n`type` = `com.warehouse.wms.inbound-receiving.<entity>.<EventName>` with\n`<entity>` one of `asn`, `receipt`. Kafka key:\n`asn_number` for `asn.*` and `receipt.*`. `data` is snake_case, optional fields are omitted when\nunset, timestamps are RFC 3339 UTC. A breaking payload change is a new\n`.v2` type, never a mutation.\n"
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
                          "registered_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the ASN was registered here (ADR 0025); omitted on events raised before it existed.",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "expected_arrival": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Omitted when the supplier gave none.",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Optional opaque tenant tag.",
                            "x-parser-schema-id": "<anonymous-schema-15>"
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
                                  "x-parser-schema-id": "<anonymous-schema-17>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-18>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-19>"
                                }
                              },
                              "x-parser-schema-id": "AsnLineData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-16>"
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
                                  "x-parser-schema-id": "<anonymous-schema-22>"
                                },
                                "parent_sscc": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-23>"
                                },
                                "kind": {
                                  "type": "string",
                                  "enum": [
                                    "HOMOGENEOUS_CASE",
                                    "MIXED"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-24>"
                                },
                                "gross_weight_g": {
                                  "type": "integer",
                                  "x-parser-schema-id": "<anonymous-schema-25>"
                                },
                                "dims": {
                                  "type": "object",
                                  "properties": {
                                    "length_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-27>"
                                    },
                                    "width_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-28>"
                                    },
                                    "height_mm": {
                                      "type": "integer",
                                      "x-parser-schema-id": "<anonymous-schema-29>"
                                    }
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-26>"
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
                                        "x-parser-schema-id": "<anonymous-schema-32>"
                                      },
                                      "sku": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-33>"
                                      },
                                      "gtin": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-34>"
                                      },
                                      "qty": {
                                        "type": "integer",
                                        "description": "Eaches.",
                                        "x-parser-schema-id": "<anonymous-schema-35>"
                                      },
                                      "lot": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-36>"
                                      },
                                      "expiry": {
                                        "type": "string",
                                        "x-parser-schema-id": "<anonymous-schema-37>"
                                      }
                                    },
                                    "x-parser-schema-id": "<anonymous-schema-31>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-30>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-21>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-20>"
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
                      "registered_at": "2026-10-08T12:00:00Z",
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
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          },
                          "reason": {
                            "type": "string",
                            "description": "Omitted when none was given.",
                            "x-parser-schema-id": "<anonymous-schema-41>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-38>"
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
              "x-no-consumer-reason": "read only by this service's own analytics projector (the asn_timeliness KPI, ADR 0025); no other consumer built yet",
              "name": "AsnLateForArrival",
              "title": "ASN late for arrival",
              "summary": "An ASN was registered after the visit it was received under had already arrived.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.AsnLateForArrival`; subject and key = the ASN number.\nRaised once per ASN, at `OpenReceipt` and only there (the only place an ASN and an\nappointment meet), when `asn_registered_at > arrived_at` of the appointment's earliest\nyard visit (ADR 0025); `lateness_seconds` = `asn_registered_at - arrived_at`, whole\nseconds, >= 1 by construction. An on-time ASN, a walk-in receipt, an appointment with\nno arrival seen yet and a legacy ASN with an unknown registration raise nothing.\n",
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
                          "asn_number",
                          "supplier_ref",
                          "appointment_id",
                          "visit_id",
                          "asn_registered_at",
                          "arrived_at",
                          "lateness_seconds"
                        ],
                        "properties": {
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "supplier_ref": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "description": "The appointment the receipt was opened from.",
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          },
                          "visit_id": {
                            "type": "string",
                            "description": "The yard visit whose arrival was the earliest seen for the appointment.",
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          },
                          "asn_registered_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the ASN was registered here (ADR 0025).",
                            "x-parser-schema-id": "<anonymous-schema-48>"
                          },
                          "arrived_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The earliest gate arrival seen for the appointment (the `visit_arrivals` local copy",
                            "ADR 0021).": null,
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "lateness_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "`asn_registered_at - arrived_at`, whole seconds; an equal or earlier registration is on time and raises nothing.",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-43>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-42>"
                  }
                ],
                "x-parser-schema-id": "AsnLateForArrivalEvent"
              },
              "examples": [
                {
                  "name": "late",
                  "summary": "ASN-1001 registered two minutes after the gate arrival of the visit it was received under.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5b7c1e93-4a0b-4c6d-9e82-3f1a2b4c5d63",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.AsnLateForArrival",
                    "subject": "ASN-1001",
                    "time": "2026-10-09T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:AsnLateForArrival:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "supplier_ref": "ACME",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "visit_id": "visit-9f1c2a34-5b6d-4e7f-8a90-b1c2d3e4f5a6",
                      "asn_registered_at": "2026-10-09T08:02:00Z",
                      "arrived_at": "2026-10-09T08:00:00Z",
                      "lateness_seconds": 120
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
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "description": "Omitted for a walk-in delivery.",
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "door_code": {
                            "type": "string",
                            "description": "Omitted when the receipt has no appointment.",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "opened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-52>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-51>"
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
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-61>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-62>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "condition": {
                            "type": "string",
                            "enum": [
                              "Good",
                              "Damaged"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Optional; omitted for fleet-owned stock.",
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "pack_gtin": {
                            "type": "string",
                            "description": "Optional; the CASE GTIN when received as cases or from a homogeneous carton.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "cases": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Optional; cases booked; `quantity` stays eaches.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Optional; the carton the quantity came from.",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-59>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-58>"
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
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "Omitted for fleet-owned stock.",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Omitted for an unlabelled carton.",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "parent_sscc": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "sealed": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "lpn": {
                            "type": "string",
                            "description": "The SSCC, or an internal `LPN-<ulid>`.",
                            "x-parser-schema-id": "<anonymous-schema-79>"
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
                                  "x-parser-schema-id": "<anonymous-schema-82>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-83>"
                                },
                                "gtin": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-84>"
                                },
                                "qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "description": "Eaches.",
                                  "x-parser-schema-id": "<anonymous-schema-85>"
                                },
                                "lot": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-86>"
                                },
                                "expiry": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-87>"
                                },
                                "condition": {
                                  "type": "string",
                                  "enum": [
                                    "Good",
                                    "Damaged"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-88>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-81>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          },
                          "sscc_source": {
                            "type": "string",
                            "enum": [
                              "supplier",
                              "receiver"
                            ],
                            "description": "Who gave the carton its SSCC (ADR 0024). `receiver` is an SSCC assigned by AssignSscc under the receiver's own GS1 company prefix. Additive and optional.",
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "best_before": {
                            "type": "string",
                            "format": "date",
                            "description": "AI 15 of the scanned label, as an ISO date; a day 00 is the last day of the month (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          },
                          "expiry": {
                            "type": "string",
                            "format": "date",
                            "description": "AI 17 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          },
                          "production_date": {
                            "type": "string",
                            "format": "date",
                            "description": "AI 11 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          },
                          "packaging_date": {
                            "type": "string",
                            "format": "date",
                            "description": "AI 13 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          },
                          "serial": {
                            "type": "string",
                            "description": "AI 21 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          },
                          "purchase_order": {
                            "type": "string",
                            "description": "AI 400 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-96>"
                          },
                          "ship_to_gln": {
                            "type": "string",
                            "pattern": "^[0-9]{13}$",
                            "description": "AI 410 of the scanned label (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-97>"
                          },
                          "ship_for_gln": {
                            "type": "string",
                            "pattern": "^[0-9]{13}$",
                            "description": "AI 413 of the scanned label; stored, never enforced (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-98>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-71>"
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
                            "x-parser-schema-id": "<anonymous-schema-101>"
                          },
                          "sscc": {
                            "type": "string",
                            "description": "Omitted when the finding has no SSCC.",
                            "x-parser-schema-id": "<anonymous-schema-102>"
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
                              "MixedCartonContentMismatch",
                              "LabelNonCompliant",
                              "WrongDestination"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-103>"
                          },
                          "expected": {
                            "type": "string",
                            "description": "A count, a SKU, or `sku:qty` / `grossWeightG:<n>` pairs (CartonOverLimit: the breached limits; MixedCartonContentMismatch: the manifest; LabelNonCompliant: the reason code, e.g. `conflicting_ais`).",
                            "x-parser-schema-id": "<anonymous-schema-104>"
                          },
                          "actual": {
                            "type": "string",
                            "description": "The counterpart of `expected` (LabelNonCompliant: the raw scan; WrongDestination: the GLN the label named).",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          },
                          "at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "w13_code": {
                            "type": "string",
                            "enum": [
                              "01",
                              "02",
                              "03",
                              "05",
                              "09"
                            ],
                            "description": "X12 W13 receiving condition code (ADR 0023). Absent when the standard has no code for the kind (LabelNonCompliant and WrongDestination have none).",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "cbv_disposition": {
                            "type": "string",
                            "description": "GS1 CBV disposition (ADR 0023, 0024), derived from the kind.",
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "supplier_ref": {
                            "type": "string",
                            "description": "The supplier of the ASN; set on LabelNonCompliant and WrongDestination so a first-pass rate can be told per supplier (ADR 0024). Optional.",
                            "x-parser-schema-id": "<anonymous-schema-109>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-100>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-99>"
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
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceiptClosed`;\nsubject = the receipt id, key = the ASN number. `discrepancies` is\npresent and empty when everything matched; a line can appear once per\nkind (`Short`, `Over`, `Damaged`); each carries `w13_code` and\n`cbv_disposition` (ADR 0023).\n",
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
                            "x-parser-schema-id": "<anonymous-schema-112>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-113>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-114>"
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
                                  "x-parser-schema-id": "<anonymous-schema-116>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-117>"
                                },
                                "kind": {
                                  "type": "string",
                                  "enum": [
                                    "Short",
                                    "Over",
                                    "Damaged"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-118>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-119>"
                                },
                                "received_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "Good plus damaged.",
                                  "x-parser-schema-id": "<anonymous-schema-120>"
                                },
                                "damaged_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "x-parser-schema-id": "<anonymous-schema-121>"
                                },
                                "w13_code": {
                                  "type": "string",
                                  "enum": [
                                    "01",
                                    "02",
                                    "03"
                                  ],
                                  "description": "X12 W13 receiving condition code of the kind (ADR 0023): Damaged 01, Short 02, Over 03.",
                                  "x-parser-schema-id": "<anonymous-schema-122>"
                                },
                                "cbv_disposition": {
                                  "type": "string",
                                  "enum": [
                                    "damaged",
                                    "mismatch_quantity"
                                  ],
                                  "description": "GS1 CBV disposition of the kind (ADR 0023).",
                                  "x-parser-schema-id": "<anonymous-schema-123>"
                                }
                              },
                              "x-parser-schema-id": "DiscrepancyData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-115>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-110>"
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
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-128>"
                          },
                          "arrived_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "yard-management's gate arrival.",
                            "x-parser-schema-id": "<anonymous-schema-129>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-130>"
                          },
                          "stowed_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The latest stow of a Good carton.",
                            "x-parser-schema-id": "<anonymous-schema-131>"
                          },
                          "dock_to_stock_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 0,
                            "description": "stowed_at - arrived_at, clamped at 0.",
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "carton_count": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "How many Good cartons were stowed.",
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-124>"
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
            },
            {
              "x-no-consumer-reason": "none yet: partner-connectivity renders it as EANCOM RECADV / X12 861 / 944 later (D-3 not taken)",
              "name": "ReceivingAdviceIssued",
              "title": "Receiving advice issued",
              "summary": "What was received and accepted per line, with W13/CBV-coded discrepancies, for the supplier or the 3PL depositor (ADR 0023).",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceIssued`;\nsubject = the receipt id, key = the ASN number. The domain fact only: this\nservice renders no EANCOM, X12 or transport. Raised exactly once per\nreceipt, in the same transaction as `ReceiptClosed` (right after it), for a\nreceipt closed after this event existed; a receipt closed earlier gets no\nadvice. `despatch_advice_ref` is the ASN number (the reference to the\ndespatch advice), `supplier_ref` the supplier as the ASN knows it and\n`owner_ref` the 3PL depositor (omitted for fleet-owned stock). `last_carton_at`\nis when the last unit was received (the receipt's opening when nothing\nwas); `within_sla` is `issued_at - last_carton_at <= sla_seconds`\n(`RECEIVING_ADVICE_SLA`, default 24 h). Per line the three quantities are\nexclusive: `accepted_qty` is the Good units not held, `rejected_qty` the\nDamaged ones and `held_qty` the Good units declared held; `received_qty`\nis their sum. `discrepancies` carry the line kinds `Short`, `Over`, `Damaged`,\n`IncorrectProduct` and `Hold` with `w13_code` and `cbv_disposition`.\nThe payload is bounded because a message the broker refuses blocks the\noutbox (ADR 0007): at most 1000 lines (lines with exceptions first, then\nin line order; `lines_total` is the real count and `lines_truncated` is\ntrue when some are left out), at most 1000 SSCCs per line (`sscc_count` is\nthe real count, `ssccs_truncated` is true when listed ones are fewer) and\nat most 200 carton findings (`carton_findings_total`). A consumer that\nneeds the full list reads the receipt over REST.\n",
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
                          "despatch_advice_ref",
                          "supplier_ref",
                          "issued_at",
                          "last_carton_at",
                          "sla_seconds",
                          "within_sla",
                          "lines",
                          "lines_total",
                          "carton_findings",
                          "carton_findings_total"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-136>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-137>"
                          },
                          "despatch_advice_ref": {
                            "type": "string",
                            "description": "The reference to the despatch advice: the ASN number.",
                            "x-parser-schema-id": "<anonymous-schema-138>"
                          },
                          "supplier_ref": {
                            "type": "string",
                            "description": "The supplier as the ASN knows it.",
                            "x-parser-schema-id": "<anonymous-schema-139>"
                          },
                          "owner_ref": {
                            "type": "string",
                            "description": "The 3PL depositor. Omitted for fleet-owned stock.",
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          },
                          "issued_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          },
                          "last_carton_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the last unit was received; the receipt's opening when nothing was.",
                            "x-parser-schema-id": "<anonymous-schema-142>"
                          },
                          "sla_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "The committed window (RECEIVING_ADVICE_SLA) in force at close.",
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          },
                          "within_sla": {
                            "type": "boolean",
                            "description": "issued_at - last_carton_at <= sla_seconds.",
                            "x-parser-schema-id": "<anonymous-schema-144>"
                          },
                          "lines": {
                            "type": "array",
                            "maxItems": 1000,
                            "description": "Lines with exceptions first, then the rest, each group in line order; bounded.",
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "expected_qty",
                                "received_qty",
                                "accepted_qty",
                                "rejected_qty",
                                "held_qty",
                                "sscc_count",
                                "discrepancies"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-147>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-148>"
                                },
                                "gtin": {
                                  "type": "string",
                                  "pattern": "^[0-9]{14}$",
                                  "description": "Omitted when the line has no known GTIN.",
                                  "x-parser-schema-id": "<anonymous-schema-149>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "x-parser-schema-id": "<anonymous-schema-150>"
                                },
                                "received_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "Accepted plus rejected plus held.",
                                  "x-parser-schema-id": "<anonymous-schema-151>"
                                },
                                "accepted_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "The Good units that are not held.",
                                  "x-parser-schema-id": "<anonymous-schema-152>"
                                },
                                "rejected_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "The Damaged units.",
                                  "x-parser-schema-id": "<anonymous-schema-153>"
                                },
                                "held_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "The Good units declared held by the Hold command.",
                                  "x-parser-schema-id": "<anonymous-schema-154>"
                                },
                                "sscc_count": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "The real number of SSCCs received on the line.",
                                  "x-parser-schema-id": "<anonymous-schema-155>"
                                },
                                "ssccs": {
                                  "type": "array",
                                  "maxItems": 1000,
                                  "items": {
                                    "type": "string",
                                    "pattern": "^[0-9]{18}$",
                                    "x-parser-schema-id": "<anonymous-schema-157>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-156>"
                                },
                                "ssccs_truncated": {
                                  "type": "boolean",
                                  "description": "True when ssccs lists fewer than sscc_count. Omitted when false.",
                                  "x-parser-schema-id": "<anonymous-schema-158>"
                                },
                                "earliest_best_before": {
                                  "type": "string",
                                  "format": "date",
                                  "description": "The earliest best-before date (AI 15) of the accepted cartons of the line (ADR 0024). Omitted when none carried one.",
                                  "x-parser-schema-id": "<anonymous-schema-159>"
                                },
                                "earliest_expiry": {
                                  "type": "string",
                                  "format": "date",
                                  "description": "The earliest expiry date (AI 17) of the accepted cartons of the line (ADR 0024). Omitted when none carried one.",
                                  "x-parser-schema-id": "<anonymous-schema-160>"
                                },
                                "discrepancies": {
                                  "type": "array",
                                  "items": {
                                    "type": "object",
                                    "required": [
                                      "kind",
                                      "quantity",
                                      "cbv_disposition"
                                    ],
                                    "properties": {
                                      "kind": {
                                        "type": "string",
                                        "enum": [
                                          "Short",
                                          "Over",
                                          "Damaged",
                                          "IncorrectProduct",
                                          "Hold"
                                        ],
                                        "x-parser-schema-id": "<anonymous-schema-163>"
                                      },
                                      "quantity": {
                                        "type": "integer",
                                        "minimum": 1,
                                        "x-parser-schema-id": "<anonymous-schema-164>"
                                      },
                                      "w13_code": {
                                        "type": "string",
                                        "enum": [
                                          "01",
                                          "02",
                                          "03",
                                          "05",
                                          "09"
                                        ],
                                        "x-parser-schema-id": "<anonymous-schema-165>"
                                      },
                                      "cbv_disposition": {
                                        "type": "string",
                                        "enum": [
                                          "damaged",
                                          "mismatch_quantity",
                                          "mismatch_class",
                                          "non_conformant"
                                        ],
                                        "x-parser-schema-id": "<anonymous-schema-166>"
                                      }
                                    },
                                    "x-parser-schema-id": "<anonymous-schema-162>"
                                  },
                                  "x-parser-schema-id": "<anonymous-schema-161>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-146>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-145>"
                          },
                          "lines_total": {
                            "type": "integer",
                            "minimum": 0,
                            "description": "The real number of lines.",
                            "x-parser-schema-id": "<anonymous-schema-167>"
                          },
                          "lines_truncated": {
                            "type": "boolean",
                            "description": "True when lines lists fewer than lines_total. Omitted when false.",
                            "x-parser-schema-id": "<anonymous-schema-168>"
                          },
                          "carton_findings": {
                            "type": "array",
                            "maxItems": 200,
                            "items": {
                              "type": "object",
                              "required": [
                                "kind",
                                "at"
                              ],
                              "properties": {
                                "kind": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-171>"
                                },
                                "sscc": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-172>"
                                },
                                "expected": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-173>"
                                },
                                "actual": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-174>"
                                },
                                "at": {
                                  "type": "string",
                                  "format": "date-time",
                                  "x-parser-schema-id": "<anonymous-schema-175>"
                                },
                                "w13_code": {
                                  "type": "string",
                                  "enum": [
                                    "01",
                                    "02",
                                    "03",
                                    "05",
                                    "09"
                                  ],
                                  "description": "Absent for a kind with no W13 code.",
                                  "x-parser-schema-id": "<anonymous-schema-176>"
                                },
                                "cbv_disposition": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-177>"
                                },
                                "supplier_ref": {
                                  "type": "string",
                                  "description": "Set on label findings (ADR 0024).",
                                  "x-parser-schema-id": "<anonymous-schema-178>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-170>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-169>"
                          },
                          "carton_findings_total": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-179>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-135>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-134>"
                  }
                ],
                "x-parser-schema-id": "ReceivingAdviceIssuedEvent"
              },
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d9e3f-5a2b-4c8d-9e0f-1a2b3c4d5e66",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceIssued",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceivingAdviceIssued:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "despatch_advice_ref": "ASN-1001",
                      "supplier_ref": "ACME",
                      "owner_ref": "tenant-7f3a",
                      "issued_at": "2026-10-09T09:30:00Z",
                      "last_carton_at": "2026-10-09T09:10:00Z",
                      "sla_seconds": 86400,
                      "within_sla": true,
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "gtin": "13041090004824",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "accepted_qty": 25,
                          "rejected_qty": 4,
                          "held_qty": 5,
                          "sscc_count": 2,
                          "ssccs": [
                            "340123450000000017",
                            "340123450000000024"
                          ],
                          "discrepancies": [
                            {
                              "kind": "Short",
                              "quantity": 6,
                              "w13_code": "02",
                              "cbv_disposition": "mismatch_quantity"
                            },
                            {
                              "kind": "Hold",
                              "quantity": 5,
                              "w13_code": "09",
                              "cbv_disposition": "non_conformant"
                            }
                          ]
                        }
                      ],
                      "lines_total": 1,
                      "carton_findings": [
                        {
                          "kind": "UnexpectedCarton",
                          "sscc": "340123450000000031",
                          "at": "2026-10-09T09:05:00Z",
                          "w13_code": "05",
                          "cbv_disposition": "mismatch_instance"
                        }
                      ],
                      "carton_findings_total": 1
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "none yet: an alarm for the planned partner-connectivity and warehouse-ops consumers (D-3)",
              "name": "ReceivingAdviceOverdue",
              "title": "Receiving advice overdue",
              "summary": "An Open receipt is past the advice SLA since its last unit was received (ADR 0023).",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceOverdue`;\nsubject = the receipt id, key = the ASN number. Raised by the housekeeping\nsweep exactly once per receipt that is still Open when\n`last_carton_at + sla_seconds` (`due_at`) is in the past. It does not stop\nthe receipt: closing it later still issues the advice, with `within_sla`\nfalse. `overdue_at` (the CloudEvents `time`) is when the sweep saw it.\n",
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
                          "last_carton_at",
                          "due_at",
                          "sla_seconds",
                          "overdue_at"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-182>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-183>"
                          },
                          "last_carton_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-184>"
                          },
                          "due_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "last_carton_at + sla_seconds.",
                            "x-parser-schema-id": "<anonymous-schema-185>"
                          },
                          "sla_seconds": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-186>"
                          },
                          "overdue_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the sweep saw the receipt past due.",
                            "x-parser-schema-id": "<anonymous-schema-187>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-181>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-180>"
                  }
                ],
                "x-parser-schema-id": "ReceivingAdviceOverdueEvent"
              },
              "examples": [
                {
                  "name": "example",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8d2e0f4a-6b3c-4d9e-af10-2b3c4d5e6f77",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceOverdue",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-10T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:ReceivingAdviceOverdue:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "last_carton_at": "2026-10-09T09:10:00Z",
                      "due_at": "2026-10-10T09:10:00Z",
                      "sla_seconds": 86400,
                      "overdue_at": "2026-10-10T10:00:00Z"
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
                      "registered_at": "2026-10-08T12:00:00Z",
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
              "name": "AsnLateForArrival",
              "title": "ASN late for arrival (analytics)",
              "summary": "An ASN was registered after its visit had arrived, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.asn.AsnLateForArrival` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:AsnLateForArrival:v1`; payload equal to the integration payload.",
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
                    "id": "5b7c1e93-4a0b-4c6d-9e82-3f1a2b4c5d63",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.asn.AsnLateForArrival",
                    "subject": "ASN-1001",
                    "time": "2026-10-09T08:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:AsnLateForArrival:v1",
                    "data": {
                      "asn_number": "ASN-1001",
                      "supplier_ref": "ACME",
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "visit_id": "visit-9f1c2a34-5b6d-4e7f-8a90-b1c2d3e4f5a6",
                      "asn_registered_at": "2026-10-09T08:02:00Z",
                      "arrived_at": "2026-10-09T08:00:00Z",
                      "lateness_seconds": 120
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3].payload",
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4].payload",
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5].payload",
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload",
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload",
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
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8].payload",
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
            },
            {
              "name": "ReceivingAdviceIssued",
              "title": "Receiving advice issued (analytics)",
              "summary": "The receiving advice, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceIssued` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceivingAdviceIssued:v1`; payload equal to the integration payload. The projector folds `within_sla` into `advice_facts`, one row per receipt (ADR 0023).",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[9].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7c1d9e3f-5a2b-4c8d-9e0f-1a2b3c4d5e66",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceIssued",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceivingAdviceIssued:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "despatch_advice_ref": "ASN-1001",
                      "supplier_ref": "ACME",
                      "owner_ref": "tenant-7f3a",
                      "issued_at": "2026-10-09T09:30:00Z",
                      "last_carton_at": "2026-10-09T09:10:00Z",
                      "sla_seconds": 86400,
                      "within_sla": true,
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "gtin": "13041090004824",
                          "expected_qty": 40,
                          "received_qty": 34,
                          "accepted_qty": 25,
                          "rejected_qty": 4,
                          "held_qty": 5,
                          "sscc_count": 2,
                          "ssccs": [
                            "340123450000000017",
                            "340123450000000024"
                          ],
                          "discrepancies": [
                            {
                              "kind": "Short",
                              "quantity": 6,
                              "w13_code": "02",
                              "cbv_disposition": "mismatch_quantity"
                            },
                            {
                              "kind": "Hold",
                              "quantity": 5,
                              "w13_code": "09",
                              "cbv_disposition": "non_conformant"
                            }
                          ]
                        }
                      ],
                      "lines_total": 1,
                      "carton_findings": [
                        {
                          "kind": "UnexpectedCarton",
                          "sscc": "340123450000000031",
                          "at": "2026-10-09T09:05:00Z",
                          "w13_code": "05",
                          "cbv_disposition": "mismatch_instance"
                        }
                      ],
                      "carton_findings_total": 1
                    }
                  }
                }
              ]
            },
            {
              "name": "ReceivingAdviceOverdue",
              "title": "Receiving advice overdue (analytics)",
              "summary": "The overdue alarm, on the analytics stream.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceOverdue` (the same as on the integration topic); dataschema `urn:warehouse:inbound-receiving:analytics:ReceivingAdviceOverdue:v1`; payload equal to the integration payload. The projector acknowledges and ignores it: the KPI reads the advices issued, not the alarms.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "analytics"
                }
              ],
              "payload": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[10].payload",
              "examples": [
                {
                  "name": "analytics",
                  "summary": "The analytics copy of the integration example (same id).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8d2e0f4a-6b3c-4d9e-af10-2b3c4d5e6f77",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.receipt.ReceivingAdviceOverdue",
                    "subject": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-10T10:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:analytics:ReceivingAdviceOverdue:v1",
                    "data": {
                      "receipt_id": "rcpt-223e4567-e89b-12d3-a456-426614174000",
                      "asn_number": "ASN-1001",
                      "last_carton_at": "2026-10-09T09:10:00Z",
                      "due_at": "2026-10-10T09:10:00Z",
                      "sla_seconds": 86400,
                      "overdue_at": "2026-10-10T10:00:00Z"
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
                            "x-parser-schema-id": "<anonymous-schema-190>"
                          },
                          "description": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-191>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-192>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-189>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-188>"
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
                            "x-parser-schema-id": "<anonymous-schema-195>"
                          },
                          "level": {
                            "type": "string",
                            "enum": [
                              "EACH",
                              "INNER",
                              "CASE",
                              "PALLET"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-196>"
                          },
                          "gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-197>"
                          },
                          "child_gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-198>"
                          },
                          "qty_of_child": {
                            "type": "integer",
                            "minimum": 2,
                            "maximum": 1000000,
                            "description": "Absent for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-199>"
                          },
                          "units_per_pack": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": 1000000,
                            "description": "Direct factor to eaches; 1 for EACH.",
                            "x-parser-schema-id": "<anonymous-schema-200>"
                          },
                          "is_orderable": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-201>"
                          },
                          "is_despatch_unit": {
                            "type": "boolean",
                            "x-parser-schema-id": "<anonymous-schema-202>"
                          },
                          "effective_from": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-203>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-204>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-194>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-193>"
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
                            "x-parser-schema-id": "<anonymous-schema-207>"
                          },
                          "level": {
                            "type": "string",
                            "enum": [
                              "EACH",
                              "INNER",
                              "CASE",
                              "PALLET"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-208>"
                          },
                          "gtin": {
                            "type": "string",
                            "pattern": "^[0-9]{14}$",
                            "x-parser-schema-id": "<anonymous-schema-209>"
                          },
                          "effective_to": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-210>"
                          },
                          "reason": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 200,
                            "x-parser-schema-id": "<anonymous-schema-211>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-212>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-206>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-205>"
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
                            "x-parser-schema-id": "<anonymous-schema-215>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-216>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-217>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-218>"
                          },
                          "aisleId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-219>"
                          },
                          "zoneId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-220>"
                          },
                          "locationType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-221>"
                          },
                          "role": {
                            "type": "string",
                            "description": "Storage, Dock, Yard, WorkCenter, Drop, Staging, QC, Consolidation or Shipping; absent means Storage.",
                            "x-parser-schema-id": "<anonymous-schema-222>"
                          },
                          "dockFlow": {
                            "type": "string",
                            "enum": [
                              "Inbound",
                              "Outbound",
                              "Both"
                            ],
                            "description": "Present only when role is Dock.",
                            "x-parser-schema-id": "<anonymous-schema-223>"
                          },
                          "activities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-225>"
                            },
                            "description": "Present only when role is WorkCenter.",
                            "x-parser-schema-id": "<anonymous-schema-224>"
                          },
                          "maxWeightKg": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-226>"
                          },
                          "maxVolumeM3": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-227>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-214>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-213>"
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
                            "x-parser-schema-id": "<anonymous-schema-230>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-231>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-232>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-233>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-229>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-228>"
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
                            "x-parser-schema-id": "<anonymous-schema-236>"
                          },
                          "direction": {
                            "type": "string",
                            "enum": [
                              "INBOUND",
                              "OUTBOUND"
                            ],
                            "description": "Only INBOUND is copied.",
                            "x-parser-schema-id": "<anonymous-schema-237>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-238>"
                          },
                          "carrier": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-239>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-240>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-241>"
                          },
                          "asn_numbers": {
                            "type": "array",
                            "description": "At least one for an INBOUND appointment.",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-243>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-242>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "dock-scheduling's aggregate version; the version guard of the copy.",
                            "x-parser-schema-id": "<anonymous-schema-244>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-235>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-234>"
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
                            "x-parser-schema-id": "<anonymous-schema-247>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-248>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-246>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-245>"
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
                            "x-parser-schema-id": "<anonymous-schema-251>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-252>"
                          },
                          "door_code": {
                            "type": "string",
                            "description": "The new door.",
                            "x-parser-schema-id": "<anonymous-schema-253>"
                          },
                          "previous_door_code": {
                            "type": "string",
                            "description": "Logged only.",
                            "x-parser-schema-id": "<anonymous-schema-254>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-255>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Must be after `window_start`.",
                            "x-parser-schema-id": "<anonymous-schema-256>"
                          },
                          "previous_window_start": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-257>"
                          },
                          "previous_window_end": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-258>"
                          },
                          "arrival_tolerance_minutes": {
                            "type": "integer",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-259>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "description": "dock-scheduling's aggregate version; the version guard of the copy.",
                            "x-parser-schema-id": "<anonymous-schema-260>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-250>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-249>"
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
                            "x-parser-schema-id": "<anonymous-schema-263>"
                          },
                          "site_id": {
                            "type": "string",
                            "description": "Ignored.",
                            "x-parser-schema-id": "<anonymous-schema-264>"
                          },
                          "from_door_code": {
                            "type": "string",
                            "description": "Logged only.",
                            "x-parser-schema-id": "<anonymous-schema-265>"
                          },
                          "to_door_code": {
                            "type": "string",
                            "description": "The new door.",
                            "x-parser-schema-id": "<anonymous-schema-266>"
                          },
                          "version": {
                            "type": "integer",
                            "format": "int64",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-267>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-262>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-261>"
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
                        "x-parser-schema-id": "<anonymous-schema-270>"
                      },
                      "appointment_id": {
                        "type": [
                          "string",
                          "null"
                        ],
                        "description": "Null for a walk-in visit, which is ignored.",
                        "x-parser-schema-id": "<anonymous-schema-271>"
                      },
                      "arrived_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The gate arrival: the start of dock-to-stock.",
                        "x-parser-schema-id": "<anonymous-schema-272>"
                      },
                      "version": {
                        "type": "integer",
                        "format": "int64",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-273>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-269>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-268>"
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
                        "x-parser-schema-id": "<anonymous-schema-276>"
                      },
                      "at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the container was stowed.",
                        "x-parser-schema-id": "<anonymous-schema-277>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-275>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-274>"
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
      "AsnLateForArrival": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2]",
      "ReceiptOpened": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3]",
      "ReceiptLineReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4]",
      "ReceiptCartonReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5]",
      "CartonDiscrepancyRaised": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6]",
      "ReceiptClosed": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7]",
      "VisitCheckedIn": "$ref:$.channels.warehouse.yard-management.events.publish.message",
      "ContainerStowed": "$ref:$.channels.warehouse.inventory.events.publish.message",
      "ReceiptStowCompleted": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8]",
      "ReceiptStowCompletedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[8]",
      "ReceivingAdviceIssued": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[9]",
      "ReceivingAdviceIssuedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[9]",
      "ReceivingAdviceOverdue": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[10]",
      "ReceivingAdviceOverdueAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[10]",
      "ASNRegisteredAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[0]",
      "ASNCancelledAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[1]",
      "AsnLateForArrivalAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[2]",
      "ReceiptOpenedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[3]",
      "ReceiptLineReceivedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[4]",
      "ReceiptCartonReceivedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[5]",
      "CartonDiscrepancyRaisedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[6]",
      "ReceiptClosedAnalytics": "$ref:$.channels.warehouse.inbound-receiving.analytics.subscribe.message.oneOf[7]",
      "ProductRegistered": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[0]",
      "ProductPackLevelDeclared": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[1]",
      "ProductPackLevelRetired": "$ref:$.channels.warehouse.product-master.events.publish.message.oneOf[2]",
      "LocationSlotRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0]",
      "LocationSlotDecommissioned": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "AsnLineData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
      "DiscrepancyData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload.allOf[1].properties.data.properties.discrepancies.items",
      "ASNRegisteredEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload",
      "ASNCancelledEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1].payload",
      "AsnLateForArrivalEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2].payload",
      "DockSchedulingAppointmentBookedEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[0].payload",
      "DockSchedulingAppointmentCancelledEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[1].payload",
      "DockSchedulingAppointmentRescheduledEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[2].payload",
      "DockSchedulingAppointmentDoorReassignedEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.oneOf[3].payload",
      "ReceiptOpenedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3].payload",
      "ReceiptLineReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4].payload",
      "ReceiptCartonReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5].payload",
      "CartonDiscrepancyRaisedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload",
      "ReceiptClosedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload",
      "ReceivingAdviceIssuedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[9].payload",
      "ReceivingAdviceOverdueEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[10].payload",
      "VisitCheckedInEvent": "$ref:$.channels.warehouse.yard-management.events.publish.message.payload",
      "ContainerStowedEvent": "$ref:$.channels.warehouse.inventory.events.publish.message.payload",
      "ReceiptStowCompletedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8].payload",
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
  