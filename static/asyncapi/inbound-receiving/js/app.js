
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
    "description": "Event catalog for the **inbound-receiving** bounded context (WMS subdomain):\nthe inbound dock workflow of ASNs, dock appointments and receipts\n(ADR 0001, ADR 0002).\n\n**Published.** The `Asn`, `DockAppointment` and `Receipt` aggregates raise\nnine events, published to `warehouse.inbound-receiving.events` through a\n**transactional outbox**: the aggregate row and its already-encoded events\nare written in ONE database transaction and a relay drains them to Kafka\n(at-least-once; the CloudEvents `id` is stored with the outbox row, so a\nretry republishes the same `id`). Consumers dedupe on `id`.\n`ReceiptLineReceived` is the **handover event**: inventory-storage consumes\nit and books `condition=Good` quantities into stock (ADR 0003); Damaged\nquantities are recorded here and not booked.\n\n**Consumed (ADR 0003).** `ProductRegistered` from\n`warehouse.product-master.events` feeds the `known_skus` local copy\n(`PRODUCT_MODE`, group from env `PRODUCT_CONSUMER_GROUP`).\n`LocationSlotRegistered` and `LocationSlotDecommissioned` from\n`warehouse.facility.events` feed the `dock_doors` local copy\n(`DOCK_DOOR_MODE`, group from env `DOCK_DOOR_CONSUMER_GROUP`). Both modes\ndefault to `permissive` (consumer not started); a `kafka` mode with an\nunset group is a boot error.\n\n**Planned, not built.** warehouse-planning consuming\n`DockAppointmentBooked` as inbound-labor demand is a documented future\nedge. Nothing consumes that event today.\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\n`specversion`, `id`, `source` (`/warehouse/inbound-receiving`), `type`,\n`subject` (the aggregate instance id), `time`, `datacontenttype`\n(`application/json`) and `dataschema`\n(`urn:warehouse:inbound-receiving:events:<EventName>:v1`) are all required.\n`type` = `com.warehouse.wms.inbound-receiving.<entity>.<EventName>` with\n`<entity>` one of `asn`, `dockappointment`, `receipt`. Kafka key:\n`asn_number` for `asn.*` and `receipt.*`, `appointment_id` for\n`dockappointment.*`. `data` is snake_case, optional fields are omitted when\nunset, timestamps are RFC 3339 UTC. A breaking payload change is a new\n`.v2` type, never a mutation.\n"
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
      "name": "dockappointment",
      "description": "Events raised by the DockAppointment aggregate."
    },
    {
      "name": "receipt",
      "description": "Events raised by the Receipt aggregate."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes."
    }
  ],
  "channels": {
    "warehouse.inbound-receiving.events": {
      "description": "This service's integration topic. Written by the outbox relay; every\nmessage carries the CloudEvents content-type header. Key = `asn_number`\nfor ASN and receipt events, `appointment_id` for appointment events.\nDispatch on the full `type`, ignore unknown types, dedupe on `id`. The\nfirst consumer is inventory-storage (`ReceiptLineReceived`).\n",
      "subscribe": {
        "operationId": "receiveInboundReceivingEvents",
        "summary": "Receive ASN, dock appointment and receipt events.",
        "description": "Subscribe to the inbound dock workflow. Route on the full `type`\n(`com.warehouse.wms.inbound-receiving.<entity>.<EventName>`).\n",
        "tags": [
          {
            "name": "asn"
          },
          {
            "name": "dockappointment"
          },
          {
            "name": "receipt"
          }
        ],
        "message": {
          "oneOf": [
            {
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
                                  "x-parser-schema-id": "<anonymous-schema-15>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-16>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-17>"
                                }
                              },
                              "x-parser-schema-id": "AsnLineData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-14>"
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
                            "x-parser-schema-id": "<anonymous-schema-20>"
                          },
                          "reason": {
                            "type": "string",
                            "description": "Omitted when none was given.",
                            "x-parser-schema-id": "<anonymous-schema-21>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-19>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-18>"
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
              "name": "DockAppointmentBooked",
              "title": "Dock appointment booked",
              "summary": "A door window was booked for a carrier.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentBooked`;\nsubject and key = the appointment id. The planned warehouse-planning\nconsumer (inbound-labor demand) is not built.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "dockappointment"
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
                          "appointment_id",
                          "door_code",
                          "carrier",
                          "window_start",
                          "window_end",
                          "asn_numbers"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "carrier": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "window_start": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          },
                          "window_end": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-28>"
                          },
                          "asn_numbers": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-30>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-29>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-22>"
                  }
                ],
                "x-parser-schema-id": "DockAppointmentBookedEvent"
              },
              "examples": [
                {
                  "name": "booked",
                  "summary": "A two-hour window at an inbound door covering ASN-1001.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4a8c2e91-5b3d-4c7f-a012-9e6d1b8f3c25",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentBooked",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-08T12:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:DockAppointmentBooked:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "carrier": "ACME Freight",
                      "window_start": "2026-10-09T08:00:00Z",
                      "window_end": "2026-10-09T10:00:00Z",
                      "asn_numbers": [
                        "ASN-1001"
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentCheckedIn",
              "title": "Dock appointment checked in",
              "summary": "The carrier arrived at the door.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCheckedIn`; subject and key = the appointment id.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "dockappointment"
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
                          "appointment_id",
                          "door_code",
                          "checked_in_at"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "checked_in_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-32>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-31>"
                  }
                ],
                "x-parser-schema-id": "DockAppointmentCheckedInEvent"
              },
              "examples": [
                {
                  "name": "checkedIn",
                  "summary": "Checked in ten minutes before the window.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9d3e5f10-2a4b-4c6d-8e7f-0b1a2c3d4e5f",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCheckedIn",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T07:50:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:DockAppointmentCheckedIn:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "checked_in_at": "2026-10-09T07:50:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentCancelled",
              "title": "Dock appointment cancelled",
              "summary": "A Booked appointment was cancelled.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCancelled`; subject and key = the appointment id.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "dockappointment"
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
                          "appointment_id",
                          "door_code"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-39>"
                          },
                          "reason": {
                            "type": "string",
                            "description": "Omitted when none was given.",
                            "x-parser-schema-id": "<anonymous-schema-40>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-37>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-36>"
                  }
                ],
                "x-parser-schema-id": "DockAppointmentCancelledEvent"
              },
              "examples": [
                {
                  "name": "cancelled",
                  "summary": "Cancelled because the carrier was delayed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "b2c4d6e8-1f3a-4b5c-9d7e-8f0a1b2c3d4e",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCancelled",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-08T18:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:DockAppointmentCancelled:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "reason": "Carrier delayed"
                    }
                  }
                }
              ]
            },
            {
              "name": "DockAppointmentCompleted",
              "title": "Dock appointment completed",
              "summary": "The receipt opened from the appointment closed.",
              "description": "`type` = `com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCompleted`;\nsubject and key = the appointment id. Keyed differently from\n`ReceiptClosed` (the ASN number), so their relative order is not\nguaranteed.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "dockappointment"
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
                          "appointment_id",
                          "door_code",
                          "completed_at"
                        ],
                        "properties": {
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "completed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-41>"
                  }
                ],
                "x-parser-schema-id": "DockAppointmentCompletedEvent"
              },
              "examples": [
                {
                  "name": "completed",
                  "summary": "Completed when the receipt closed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c3d5e7f9-2a4b-4c6d-8e0f-1a2b3c4d5e6f",
                    "source": "/warehouse/inbound-receiving",
                    "type": "com.warehouse.wms.inbound-receiving.dockappointment.DockAppointmentCompleted",
                    "subject": "appt-123e4567-e89b-12d3-a456-426614174000",
                    "time": "2026-10-09T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:inbound-receiving:events:DockAppointmentCompleted:v1",
                    "data": {
                      "appointment_id": "appt-123e4567-e89b-12d3-a456-426614174000",
                      "door_code": "WH1-DOCK-IN-01",
                      "completed_at": "2026-10-09T09:30:00Z"
                    }
                  }
                }
              ]
            },
            {
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
                            "x-parser-schema-id": "<anonymous-schema-48>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "description": "Omitted for a walk-in delivery.",
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          },
                          "door_code": {
                            "type": "string",
                            "description": "Omitted when the receipt has no appointment.",
                            "x-parser-schema-id": "<anonymous-schema-51>"
                          },
                          "opened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-46>"
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
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-59>"
                          },
                          "condition": {
                            "type": "string",
                            "enum": [
                              "Good",
                              "Damaged"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-61>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-53>"
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
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "asn_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-66>"
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
                                  "x-parser-schema-id": "<anonymous-schema-68>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-69>"
                                },
                                "kind": {
                                  "type": "string",
                                  "enum": [
                                    "Short",
                                    "Over",
                                    "Damaged"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-70>"
                                },
                                "expected_qty": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-71>"
                                },
                                "received_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "description": "Good plus damaged.",
                                  "x-parser-schema-id": "<anonymous-schema-72>"
                                },
                                "damaged_qty": {
                                  "type": "integer",
                                  "minimum": 0,
                                  "x-parser-schema-id": "<anonymous-schema-73>"
                                }
                              },
                              "x-parser-schema-id": "DiscrepancyData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-63>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-62>"
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
            }
          ]
        }
      }
    },
    "warehouse.product-master.events": {
      "description": "product-master's integration topic. Consumed ONLY for `ProductRegistered`\n(ADR 0003), into the `known_skus` local copy, with a stable consumer\ngroup read from env `PRODUCT_CONSUMER_GROUP`; the consumer is started\nonly when `PRODUCT_MODE=kafka`. Every other type on the topic is ignored.\n",
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
                        "x-parser-schema-id": "<anonymous-schema-76>"
                      },
                      "description": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-77>"
                      },
                      "version": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-75>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-74>"
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
        }
      }
    },
    "warehouse.facility.events": {
      "description": "facility-layout's integration topic. Consumed ONLY for\n`LocationSlotRegistered` and `LocationSlotDecommissioned` (ADR 0003),\ninto the `dock_doors` local copy, with a stable consumer group read from\nenv `DOCK_DOOR_CONSUMER_GROUP`; the consumer is started only when\n`DOCK_DOOR_MODE=kafka`. Every other type on the topic is ignored. Key =\n`locationCode`.\n",
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
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-82>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-84>"
                          },
                          "aisleId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-85>"
                          },
                          "zoneId": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          },
                          "locationType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-87>"
                          },
                          "role": {
                            "type": "string",
                            "description": "Storage, Dock, Yard, WorkCenter, Drop, Staging, QC, Consolidation or Shipping; absent means Storage.",
                            "x-parser-schema-id": "<anonymous-schema-88>"
                          },
                          "dockFlow": {
                            "type": "string",
                            "enum": [
                              "Inbound",
                              "Outbound",
                              "Both"
                            ],
                            "description": "Present only when role is Dock.",
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          },
                          "activities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-91>"
                            },
                            "description": "Present only when role is WorkCenter.",
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "maxWeightKg": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-92>"
                          },
                          "maxVolumeM3": {
                            "type": "number",
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-79>"
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
                            "x-parser-schema-id": "<anonymous-schema-96>"
                          },
                          "eventType": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-97>"
                          },
                          "occurredAt": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-98>"
                          },
                          "locationCode": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-95>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-94>"
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
    }
  },
  "components": {
    "messages": {
      "ASNRegistered": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0]",
      "ASNCancelled": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1]",
      "DockAppointmentBooked": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2]",
      "DockAppointmentCheckedIn": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3]",
      "DockAppointmentCancelled": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4]",
      "DockAppointmentCompleted": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5]",
      "ReceiptOpened": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6]",
      "ReceiptLineReceived": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7]",
      "ReceiptClosed": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8]",
      "ProductRegistered": "$ref:$.channels.warehouse.product-master.events.publish.message",
      "LocationSlotRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0]",
      "LocationSlotDecommissioned": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "AsnLineData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
      "DiscrepancyData": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8].payload.allOf[1].properties.data.properties.discrepancies.items",
      "ASNRegisteredEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[0].payload",
      "ASNCancelledEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[1].payload",
      "DockAppointmentBookedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[2].payload",
      "DockAppointmentCheckedInEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[3].payload",
      "DockAppointmentCancelledEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[4].payload",
      "DockAppointmentCompletedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[5].payload",
      "ReceiptOpenedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[6].payload",
      "ReceiptLineReceivedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[7].payload",
      "ReceiptClosedEvent": "$ref:$.channels.warehouse.inbound-receiving.events.subscribe.message.oneOf[8].payload",
      "ProductRegisteredEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.payload",
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
  