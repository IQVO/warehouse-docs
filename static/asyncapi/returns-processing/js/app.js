
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "returns-processing Domain Events",
    "version": "1.0.0",
    "contact": {
      "name": "returns-processing maintainers",
      "url": "https://github.com/IQVO/returns-processing",
      "email": "returns-processing@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event catalog for the **returns-processing** bounded context (WMS\nsubdomain): the reverse flow of goods — authorize a return against a\nshipped order line (RMA), receive and grade it (ReturnReceipt), decide\nwhat happens to it (Disposition) and hand restockable units back to\ninventory-storage as a staged line (ADR 0001, ADR 0002).\n\n**Published.** Three aggregates raise seven event types, published to\n`warehouse.returns-processing.events` through a **transactional outbox**:\nthe aggregate row and its already-encoded events are written in ONE\ndatabase transaction and a relay drains them to Kafka (at-least-once; the\nCloudEvents `id` is stored with the outbox row, so a retry republishes the\nsame `id`). `ReturnLineStaged` is the only type that asks a sibling to do\nsomething: inventory-storage consumes it into its staged-receipt use case\n(same shape as its `ReceiptLineReceived` plus `rma_id`, `disposition_id`,\n`site_id`); `UnexpectedReturnReceived` is what exception-management turns\ninto a problem-solve case. An analytics mirror on\n`warehouse.returns-processing.analytics` is planned, not built (ADR 0004).\n\n**Consumed (ADR 0003).** `ProductClassified` from product-master, the\nallocated order lines (`OrderAllocated` / `OrderPartiallyAllocated`) from\norder-management and `PackageManifested` (the shipped fact per work unit,\n`order_ref` = `{order_id}-line-{line_no}`) from fulfillment-execution.\nEach feeds a durable local copy; no sibling is ever called live. Consumer\ngroups come from `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`,\n`ORDER_LINES_CONSUMER_GROUP` and `MANIFEST_CONSUMER_GROUP`. The consumed\nmessages below are the producers' own contracts, restated here and never\nimported.\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\nOptional W3C trace-context headers (`traceparent`, and `tracestate` /\n`baggage` when present) carry the trace of the request that wrote the\noutbox row; consumers may extract them, and must not require them.\n`specversion`, `id`, `source` (`/warehouse/returns-processing`), `type`,\n`subject`, `time`, `datacontenttype` (`application/json`) and `dataschema`\n(`urn:warehouse:returns-processing:events:<EventName>:v1`) are all\nrequired. Kafka key = the subject. Type =\n`com.warehouse.wms.returns-processing.<entity>.<EventName>`. A breaking\npayload change is a new `.v2` type, never a mutation.\n"
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
      "name": "returns-processing",
      "description": "The returns-processing bounded context (WMS subdomain)."
    },
    {
      "name": "returnauthorization",
      "description": "Events raised by the ReturnAuthorization (RMA) aggregate."
    },
    {
      "name": "returnreceipt",
      "description": "Events raised by the ReturnReceipt aggregate."
    },
    {
      "name": "disposition",
      "description": "Events raised by the Disposition aggregate."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes (ADR 0003)."
    }
  ],
  "channels": {
    "warehouse.returns-processing.events": {
      "description": "This service's integration topic. Written by the outbox relay; key = the\nevent's subject; every message carries the CloudEvents content-type\nheader (plus the optional W3C `traceparent` of the writing request).\nDispatch on the full `type`, ignore unknown types, dedupe on `id`.\n",
      "subscribe": {
        "operationId": "receiveReturnsProcessingEvents",
        "summary": "Receive RMA, receipt and disposition events.",
        "description": "Subscribe to the reverse flow of goods: authorizations and their\nrejections, arrivals and inspection grades, the policy decision per\ninspected line and, only for a RESTOCK outcome, the staged line\nhanded to inventory-storage. Route on the full `type`\n(`com.warehouse.wms.returns-processing.<entity>.<EventName>`).\n",
        "tags": [
          {
            "name": "returns-processing"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ReturnAuthorized",
              "title": "Return authorized",
              "summary": "An RMA was opened for a shipped order line inside the return window.",
              "description": "`type` = `com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorized`;\nsubject and key = the rmaId. `window_ends_at` is the policy window's\nend (authorized_at + return window days); the goods must arrive before\nit. `quantity` is capped by `DispositionPolicy.max_units_per_line`\n(the shipped-quantity check is planned, ADR 0003).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "returnauthorization"
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
                        "description": "The aggregate instance id (rmaId",
                        "receiptId or dispositionId for this service's events).": null,
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
                          "rma_id",
                          "order_id",
                          "line_no",
                          "sku",
                          "quantity",
                          "site_id",
                          "reason_code",
                          "window_ends_at",
                          "authorized_at"
                        ],
                        "properties": {
                          "rma_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-11>"
                          },
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-12>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Capped by the policy's max_units_per_line; the shipped-quantity check is planned.",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "reason_code": {
                            "type": "string",
                            "description": "The operator's return reason, e.g. DAMAGED, WRONG_ITEM, NOT_NEEDED.",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "window_ends_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The last instant the goods may arrive.",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "authorized_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "ReturnAuthorizedEvent"
              },
              "examples": [
                {
                  "name": "authorized",
                  "summary": "2 units of SKU-1 from line 1 of order ord-7c9e may come back to WH1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9f2c1d3e-5a4b-4c6d-8e7f-1a2b3c4d5e6f",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorized",
                    "subject": "rma-4d5e6f7a-8b9c-4d0e-a1f2-3b4c5d6e7f80",
                    "time": "2026-10-21T09:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:ReturnAuthorized:v1",
                    "data": {
                      "rma_id": "rma-4d5e6f7a-8b9c-4d0e-a1f2-3b4c5d6e7f80",
                      "order_id": "ord-7c9e2f1a",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 2,
                      "site_id": "WH1",
                      "reason_code": "DAMAGED",
                      "window_ends_at": "2026-11-20T09:30:00Z",
                      "authorized_at": "2026-10-21T09:30:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReturnAuthorizationRejected",
              "title": "Return authorization rejected",
              "summary": "An RMA request was refused: the line never shipped, the window closed or another RMA is open.",
              "description": "`type` = `com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorizationRejected`;\nsubject and key = the rmaId. `rejection_code` is `LINE_NOT_MANIFESTED`,\n`RETURN_WINDOW_EXPIRED`, `OPEN_RMA_EXISTS` or\n`QUANTITY_EXCEEDS_POLICY`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "returnauthorization"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "rma_id",
                          "order_id",
                          "line_no",
                          "sku",
                          "quantity",
                          "rejection_code",
                          "rejected_at"
                        ],
                        "properties": {
                          "rma_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-22>"
                          },
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-23>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "rejection_code": {
                            "type": "string",
                            "enum": [
                              "LINE_NOT_MANIFESTED",
                              "RETURN_WINDOW_EXPIRED",
                              "OPEN_RMA_EXISTS",
                              "QUANTITY_EXCEEDS_POLICY"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          },
                          "rejected_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-28>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-21>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-20>"
                  }
                ],
                "x-parser-schema-id": "ReturnAuthorizationRejectedEvent"
              },
              "examples": [
                {
                  "name": "rejected",
                  "summary": "The order line has no manifested work unit, so nothing provably shipped.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1e3f5a7c-9b1d-4f2a-8c3e-5d6f7a8b9c0d",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.returnauthorization.ReturnAuthorizationRejected",
                    "subject": "rma-6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b90",
                    "time": "2026-10-21T09:31:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:ReturnAuthorizationRejected:v1",
                    "data": {
                      "rma_id": "rma-6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b90",
                      "order_id": "ord-7c9e2f1a",
                      "line_no": 2,
                      "sku": "SKU-2",
                      "quantity": 1,
                      "rejection_code": "LINE_NOT_MANIFESTED",
                      "rejected_at": "2026-10-21T09:31:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReturnReceiptOpened",
              "title": "Return receipt opened",
              "summary": "Returned goods arrived; each line matches an RMA line or is explicitly unexpected.",
              "description": "`type` = `com.warehouse.wms.returns-processing.returnreceipt.ReturnReceiptOpened`;\nsubject and key = the receiptId. `rma_id` is null when the whole\nparcel was unexpected. Every line carries its own nullable `rma_id`: a\nnon-null value is a matched line, null means the line is UNEXPECTED\n(there is no silent third state). UNEXPECTED lines additionally raise\n`UnexpectedReturnReceived` for exception-management.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "returnreceipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "receipt_id",
                          "rma_id",
                          "site_id",
                          "opened_at",
                          "lines"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-31>"
                          },
                          "rma_id": {
                            "type": "string",
                            "nullable": true,
                            "description": "The RMA the parcel was opened against; null when the whole parcel is unexpected.",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "opened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "lines": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "quantity",
                                "rma_id"
                              ],
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-36>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-37>"
                                },
                                "quantity": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-38>"
                                },
                                "rma_id": {
                                  "type": "string",
                                  "nullable": true,
                                  "description": "The RMA this line matches; null means the line is UNEXPECTED.",
                                  "x-parser-schema-id": "<anonymous-schema-39>"
                                }
                              },
                              "x-parser-schema-id": "ReceiptLineData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-29>"
                  }
                ],
                "x-parser-schema-id": "ReturnReceiptOpenedEvent"
              },
              "examples": [
                {
                  "name": "opened",
                  "summary": "A parcel against one RMA with one matched line and one unexpected line.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2f4a6b8c-0d2e-4a3b-9c4d-6e7f8a9b0c1d",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.returnreceipt.ReturnReceiptOpened",
                    "subject": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                    "time": "2026-10-22T14:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:ReturnReceiptOpened:v1",
                    "data": {
                      "receipt_id": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                      "rma_id": "rma-4d5e6f7a-8b9c-4d0e-a1f2-3b4c5d6e7f80",
                      "site_id": "WH1",
                      "opened_at": "2026-10-22T14:05:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-1",
                          "quantity": 2,
                          "rma_id": "rma-4d5e6f7a-8b9c-4d0e-a1f2-3b4c5d6e7f80"
                        },
                        {
                          "line_no": 2,
                          "sku": "SKU-9",
                          "quantity": 1,
                          "rma_id": null
                        }
                      ]
                    }
                  }
                }
              ]
            },
            {
              "name": "ReturnLineInspected",
              "title": "Return line inspected",
              "summary": "A receipt line was graded A, B, C or SCRAP with its reason codes.",
              "description": "`type` = `com.warehouse.wms.returns-processing.returnreceipt.ReturnLineInspected`;\nsubject and key = the receiptId. `quantity` is the inspected quantity,\nnever more than the received quantity of the line; a line is inspected\nexactly once. The disposition is decided in the same transaction and\nraises its own `DispositionDecided`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "returnreceipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                          "grade",
                          "reason_codes",
                          "inspected_at"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-42>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "The inspected quantity; never more than the received quantity of the line.",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "grade": {
                            "type": "string",
                            "enum": [
                              "A",
                              "B",
                              "C",
                              "SCRAP"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          },
                          "reason_codes": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-48>"
                            },
                            "description": "Why the grade; e.g. CUSTOMER_DAMAGE, OPENED_BOX, MISSING_PARTS.",
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          },
                          "inspected_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-40>"
                  }
                ],
                "x-parser-schema-id": "ReturnLineInspectedEvent"
              },
              "examples": [
                {
                  "name": "inspected",
                  "summary": "Line 1 graded B for customer damage.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3a5b7c9d-1e2f-4b3c-8d4e-7f8a9b0c1d2e",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.returnreceipt.ReturnLineInspected",
                    "subject": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                    "time": "2026-10-22T15:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:ReturnLineInspected:v1",
                    "data": {
                      "receipt_id": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 2,
                      "grade": "B",
                      "reason_codes": [
                        "CUSTOMER_DAMAGE"
                      ],
                      "inspected_at": "2026-10-22T15:10:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "UnexpectedReturnReceived",
              "title": "Unexpected return received",
              "summary": "A received line has no matching RMA; exception-management opens a case.",
              "description": "`type` = `com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived`;\nsubject and key = the receiptId. Raised per UNEXPECTED receipt line\n(the receipt-level fact is `ReturnReceiptOpened`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "returnreceipt"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                            "x-parser-schema-id": "<anonymous-schema-52>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-53>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-54>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-50>"
                  }
                ],
                "x-parser-schema-id": "UnexpectedReturnReceivedEvent"
              },
              "examples": [
                {
                  "name": "unexpected",
                  "summary": "One unit of SKU-9 arrived with no RMA.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4b6c8d9e-2f3a-4c4d-9e5f-8a9b0c1d2e3f",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived",
                    "subject": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                    "time": "2026-10-22T14:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:UnexpectedReturnReceived:v1",
                    "data": {
                      "receipt_id": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                      "line_no": 2,
                      "sku": "SKU-9",
                      "quantity": 1,
                      "site_id": "WH1",
                      "received_at": "2026-10-22T14:05:00Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "DispositionDecided",
              "title": "Disposition decided",
              "summary": "The policy outcome for one inspected line: RESTOCK, REFURBISH, LIQUIDATE, DISPOSE or RTV.",
              "description": "`type` = `com.warehouse.wms.returns-processing.disposition.DispositionDecided`;\nsubject and key = the dispositionId. The decision is the pure function\n`Decide(grade, classification, policy)` and records the\n`policy_version` it used. An operator override is a NEW Disposition\nwhose `supersedes` names the original and whose `reason` is mandatory;\nboth fields are null on a policy decision.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "disposition"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "disposition_id",
                          "receipt_id",
                          "line_no",
                          "sku",
                          "quantity",
                          "grade",
                          "outcome",
                          "policy_version",
                          "supersedes",
                          "reason",
                          "decided_at"
                        ],
                        "properties": {
                          "disposition_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-60>"
                          },
                          "receipt_id": {
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
                          "grade": {
                            "type": "string",
                            "enum": [
                              "A",
                              "B",
                              "C",
                              "SCRAP"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "outcome": {
                            "type": "string",
                            "enum": [
                              "RESTOCK",
                              "REFURBISH",
                              "LIQUIDATE",
                              "DISPOSE",
                              "RTV"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          },
                          "policy_version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          },
                          "supersedes": {
                            "type": "string",
                            "nullable": true,
                            "description": "The disposition this override supersedes; null on a policy decision.",
                            "x-parser-schema-id": "<anonymous-schema-68>"
                          },
                          "reason": {
                            "type": "string",
                            "nullable": true,
                            "description": "Mandatory on an override; null on a policy decision.",
                            "x-parser-schema-id": "<anonymous-schema-69>"
                          },
                          "decided_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-70>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-59>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-58>"
                  }
                ],
                "x-parser-schema-id": "DispositionDecidedEvent"
              },
              "examples": [
                {
                  "name": "decided",
                  "summary": "Grade B of a standard SKU restocks (policy v3).",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c7d9e0f-3a4b-4d5e-8f6a-9b0c1d2e3f4a",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.disposition.DispositionDecided",
                    "subject": "disp-0c1d2e3f-4a5b-4e6f-9a7b-8c9d0e1f2a3b",
                    "time": "2026-10-22T15:10:01Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:DispositionDecided:v1",
                    "data": {
                      "disposition_id": "disp-0c1d2e3f-4a5b-4e6f-9a7b-8c9d0e1f2a3b",
                      "receipt_id": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 2,
                      "grade": "B",
                      "outcome": "RESTOCK",
                      "policy_version": 3,
                      "supersedes": null,
                      "reason": null,
                      "decided_at": "2026-10-22T15:10:01Z"
                    }
                  }
                }
              ]
            },
            {
              "name": "ReturnLineStaged",
              "title": "Return line staged",
              "summary": "A RESTOCK disposition hands the goods to inventory-storage as a staged receipt line.",
              "description": "`type` = `com.warehouse.wms.returns-processing.disposition.ReturnLineStaged`;\nsubject and key = the dispositionId. `data` is inbound-receiving's\n`ReceiptLineReceived` shape (`receipt_id`, `line_no`, `sku`,\n`quantity`, `condition`, `received_at`) plus `rma_id`,\n`disposition_id` and `site_id`; inventory-storage consumes it into its\nstaged-receipt use case and the stow stays an RF action there. Raised\nexactly once per RESTOCK disposition (idempotent on `disposition_id`);\nno other outcome touches any sibling.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "disposition"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
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
                          "condition",
                          "received_at",
                          "rma_id",
                          "disposition_id",
                          "site_id"
                        ],
                        "properties": {
                          "receipt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          },
                          "line_no": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "sku": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "quantity": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "condition": {
                            "type": "string",
                            "const": "Good",
                            "description": "inbound-receiving's ReceiptLineReceived carries this field; a staged return line is always Good.",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "received_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "When the line arrived on the receipt.",
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "rma_id": {
                            "type": "string",
                            "description": "The RMA the line was authorized against.",
                            "x-parser-schema-id": "<anonymous-schema-79>"
                          },
                          "disposition_id": {
                            "type": "string",
                            "description": "The RESTOCK disposition this staging belongs to; the idempotency key downstream.",
                            "x-parser-schema-id": "<anonymous-schema-80>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-71>"
                  }
                ],
                "x-parser-schema-id": "ReturnLineStagedEvent"
              },
              "examples": [
                {
                  "name": "staged",
                  "summary": "The 2 restockable units are staged at WH1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6d8e0f1a-4b5c-4e6f-9a7b-8c9d0e1f2a3c",
                    "source": "/warehouse/returns-processing",
                    "type": "com.warehouse.wms.returns-processing.disposition.ReturnLineStaged",
                    "subject": "disp-0c1d2e3f-4a5b-4e6f-9a7b-8c9d0e1f2a3b",
                    "time": "2026-10-22T15:10:02Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:returns-processing:events:ReturnLineStaged:v1",
                    "data": {
                      "receipt_id": "rcpt-8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d",
                      "line_no": 1,
                      "sku": "SKU-1",
                      "quantity": 2,
                      "condition": "Good",
                      "received_at": "2026-10-22T14:05:00Z",
                      "rma_id": "rma-4d5e6f7a-8b9c-4d0e-a1f2-3b4c5d6e7f80",
                      "disposition_id": "disp-0c1d2e3f-4a5b-4e6f-9a7b-8c9d0e1f2a3b",
                      "site_id": "WH1"
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
      "description": "product-master's integration topic. This service consumes ONLY\n`ProductClassified` (subject and key = the SKU) under a stable consumer\ngroup read from env `PRODUCT_CLASSIFICATION_CONSUMER_GROUP`. Every other\ntype on the topic is ignored.\n",
      "publish": {
        "operationId": "consumeProductMasterEvents",
        "summary": "Consume the product classification of each SKU.",
        "description": "`ProductClassified` feeds the `product_classifications` local copy: the\nhazmat flag, DOT hazard class and temperature class that the\ndisposition policy keys on. A message is applied only when its\n`version` is greater than the stored one for the SKU (grades stay\nfail-open; RESTOCK of a hazmat SKU without a DOT rating stays\nfail-closed). The CloudEvents `id` claim and the effect commit in one\ntransaction; the offset is committed afterwards (ADR 0003).\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "ProductClassified",
          "title": "ProductClassified (consumed, product-master)",
          "summary": "The handling classification of a SKU, with a monotonically increasing version.",
          "description": "`type` = `com.warehouse.wms.product-master.product.ProductClassified`,\nsource `/warehouse/product-master`, dataschema\n`urn:warehouse:product-master:events:ProductClassified:v1`. Subject and\nKafka key = the SKU. `handling_tags` can carry `Hazmat` and\n`TemperatureSensitive`; `dot_hazard_class` is 0 when the SKU carries\nno rating; `classification_source` is `native` or `imported`. Apply\nonly when `version` is greater than the stored one for the SKU.\nRestated from product-master's contract, never imported.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "sku",
                      "handling_tags",
                      "temperature_class",
                      "dot_hazard_class",
                      "classification_source",
                      "version"
                    ],
                    "properties": {
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-84>"
                      },
                      "handling_tags": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-86>"
                        },
                        "description": "e.g. Hazmat, TemperatureSensitive; empty for an untagged SKU.",
                        "x-parser-schema-id": "<anonymous-schema-85>"
                      },
                      "temperature_class": {
                        "type": "string",
                        "description": "Ambient, Chilled, Frozen or the producer's empty default.",
                        "x-parser-schema-id": "<anonymous-schema-87>"
                      },
                      "dot_hazard_class": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "The DOT hazard class; 0 means the SKU carries no rating.",
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      },
                      "classification_source": {
                        "type": "string",
                        "description": "native or imported.",
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      },
                      "version": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "Per-SKU monotonically increasing; apply only when greater than the stored one.",
                        "x-parser-schema-id": "<anonymous-schema-90>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-83>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-82>"
              }
            ],
            "x-parser-schema-id": "ProductClassifiedEvent"
          },
          "examples": [
            {
              "name": "hazmatFrozen",
              "summary": "SKU-1 is hazmat, temperature-sensitive and frozen, DOT class 3.",
              "payload": {
                "specversion": "1.0",
                "id": "7e9f1a2b-5c6d-4f7a-8b8c-9d0e1f2a3b4c",
                "source": "/warehouse/product-master",
                "type": "com.warehouse.wms.product-master.product.ProductClassified",
                "subject": "SKU-1",
                "time": "2026-10-18T08:00:00Z",
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
    "warehouse.order-management.events": {
      "description": "order-management's integration topic. This service consumes\n`OrderAllocated` and `OrderPartiallyAllocated` (subject and key = the\norder id) under a stable consumer group read from env\n`ORDER_LINES_CONSUMER_GROUP`. Every other type on the topic is ignored.\n",
      "publish": {
        "operationId": "consumeOrderManagementEvents",
        "summary": "Consume the allocated order lines.",
        "description": "The lines of both types feed the `allocated_order_lines` local copy:\none row per (order_id, line_no) with its SKU, refreshed on every\nallocation event. The lines carry NO quantity; v1 therefore caps the\nauthorized quantity by `DispositionPolicy.max_units_per_line` and the\nshipped-quantity check stays planned (ADR 0003). The CloudEvents `id`\nclaim and the effect commit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "OrderAllocated",
              "title": "OrderAllocated (consumed, order-management)",
              "summary": "Every line of an order was allocated; the lines carry no quantity.",
              "description": "`type` = `com.warehouse.wes.order-management.order.OrderAllocated`,\nsource `/warehouse/order-management`, dataschema\n`urn:warehouse:order-management:events:OrderAllocated:v1`. Subject and\nKafka key = the order id. The `lines` carry `line_no`, `sku`, `path_id`,\n`gift_wrap` and `fulfillment_class` but NO quantity. Restated from\norder-management's contract, never imported.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "order_id",
                          "promise_date",
                          "lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-93>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-94>"
                          },
                          "lines": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                              "type": "object",
                              "required": [
                                "line_no",
                                "sku",
                                "path_id",
                                "gift_wrap",
                                "fulfillment_class"
                              ],
                              "description": "An allocated order line. There is NO quantity on it.",
                              "properties": {
                                "line_no": {
                                  "type": "integer",
                                  "minimum": 1,
                                  "x-parser-schema-id": "<anonymous-schema-96>"
                                },
                                "sku": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-97>"
                                },
                                "path_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-98>"
                                },
                                "gift_wrap": {
                                  "type": "boolean",
                                  "x-parser-schema-id": "<anonymous-schema-99>"
                                },
                                "fulfillment_class": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-100>"
                                }
                              },
                              "x-parser-schema-id": "AllocatedLine"
                            },
                            "x-parser-schema-id": "<anonymous-schema-95>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-92>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-91>"
                  }
                ],
                "x-parser-schema-id": "OrderAllocatedEvent"
              },
              "examples": [
                {
                  "name": "allocated",
                  "summary": "A one-line order allocated to the pick path.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8f0a2b3c-6d7e-4a8b-9c9d-0e1f2a3b4c5d",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderAllocated",
                    "subject": "ord-7c9e2f1a",
                    "time": "2026-10-19T10:01:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderAllocated:v1",
                    "data": {
                      "order_id": "ord-7c9e2f1a",
                      "promise_date": "2026-09-09T10:01:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-BOOK-0001",
                          "path_id": "pick",
                          "gift_wrap": false,
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
              "title": "OrderPartiallyAllocated (consumed, order-management)",
              "summary": "Some lines of an order were allocated; the same line shape as OrderAllocated.",
              "description": "`type` = `com.warehouse.wes.order-management.order.OrderPartiallyAllocated`,\nsource `/warehouse/order-management`, dataschema\n`urn:warehouse:order-management:events:OrderPartiallyAllocated:v1`.\nSubject and Kafka key = the order id. `lines` holds ONLY the allocated\nlines, in the same shape as `OrderAllocated` (no quantity). Restated\nfrom order-management's contract, never imported.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "data": {
                        "type": "object",
                        "required": [
                          "order_id",
                          "promise_date",
                          "lines"
                        ],
                        "properties": {
                          "order_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-103>"
                          },
                          "promise_date": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-104>"
                          },
                          "lines": {
                            "type": "array",
                            "minItems": 1,
                            "description": "ONLY the allocated lines, in the same shape as OrderAllocated.",
                            "items": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-102>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-101>"
                  }
                ],
                "x-parser-schema-id": "OrderPartiallyAllocatedEvent"
              },
              "examples": [
                {
                  "name": "partiallyAllocated",
                  "summary": "Line 1 of the order allocated, line 2 not yet.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9a1b3c4d-7e8f-4b9c-8d0e-1f2a3b4c5d6e",
                    "source": "/warehouse/order-management",
                    "type": "com.warehouse.wes.order-management.order.OrderPartiallyAllocated",
                    "subject": "ord-7c9e2f1a",
                    "time": "2026-10-19T10:03:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:order-management:events:OrderPartiallyAllocated:v1",
                    "data": {
                      "order_id": "ord-7c9e2f1a",
                      "promise_date": "2026-09-09T10:01:00Z",
                      "lines": [
                        {
                          "line_no": 1,
                          "sku": "SKU-BOOK-0001",
                          "path_id": "pick",
                          "gift_wrap": false,
                          "fulfillment_class": "SAME_SKU_MULTI"
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
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's integration topic. This service consumes ONLY\n`PackageManifested` (subject and key = the package id) under a stable\nconsumer group read from env `MANIFEST_CONSUMER_GROUP`. Every other type\non the topic is ignored.\n",
      "publish": {
        "operationId": "consumeFulfillmentEvents",
        "summary": "Consume the manifested work units (the shipped fact).",
        "description": "`PackageManifested` feeds the `manifested_work_units` local copy after\nreversing `order_ref` (a WES work unit id `{order_id}-line-{line_no}`)\ninto (order_id, line_no). A return is authorizable only against a line\nwhose work unit appears in this copy (ADR 0002, invariant 2). The\nCloudEvents `id` claim and the effect commit in one transaction.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "PackageManifested",
          "title": "PackageManifested (consumed, fulfillment-execution)",
          "summary": "A package was manifested for a work unit: the shipped fact returns v1 authorizes against.",
          "description": "`type` = `com.warehouse.wes.fulfillment-execution.package.PackageManifested`,\nsource `/warehouse/fulfillment-execution`, dataschema\n`urn:warehouse:fulfillment-execution:events:PackageManifested:v1`.\nSubject and Kafka key = the package id. `order_ref` is the WES work\nunit id `{order_id}-line-{line_no}`; this service reverses it into\n(order_id, line_no) to build its `manifested_work_units` copy.\nRestated from fulfillment-execution's contract, never imported.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "allOf": [
              "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "data": {
                    "type": "object",
                    "required": [
                      "package_id",
                      "order_ref"
                    ],
                    "properties": {
                      "package_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-108>"
                      },
                      "order_ref": {
                        "type": "string",
                        "description": "The WES work unit id {order_id}-line-{line_no}.",
                        "x-parser-schema-id": "<anonymous-schema-109>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-107>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-106>"
              }
            ],
            "x-parser-schema-id": "PackageManifestedEvent"
          },
          "examples": [
            {
              "name": "manifested",
              "summary": "Package pkg-1029 manifested for work unit ord-7c9e2f1a-line-1.",
              "payload": {
                "specversion": "1.0",
                "id": "0b2c4d5e-8f9a-4c0d-9e1f-2a3b4c5d6e7f",
                "source": "/warehouse/fulfillment-execution",
                "type": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                "subject": "pkg-1029",
                "time": "2026-10-20T11:20:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                "data": {
                  "package_id": "pkg-1029",
                  "order_ref": "ord-7c9e2f1a-line-1"
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
      "ReturnAuthorized": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0]",
      "ReturnAuthorizationRejected": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[1]",
      "ReturnReceiptOpened": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[2]",
      "ReturnLineInspected": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[3]",
      "UnexpectedReturnReceived": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[4]",
      "DispositionDecided": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[5]",
      "ReturnLineStaged": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[6]",
      "ProductClassified": "$ref:$.channels.warehouse.product-master.events.publish.message",
      "OrderAllocated": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0]",
      "OrderPartiallyAllocated": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[1]",
      "PackageManifested": "$ref:$.channels.warehouse.fulfillment.events.publish.message"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "ReturnAuthorizedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[0].payload",
      "ReturnAuthorizationRejectedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[1].payload",
      "ReceiptLineData": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data.properties.lines.items",
      "ReturnReceiptOpenedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[2].payload",
      "ReturnLineInspectedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[3].payload",
      "UnexpectedReturnReceivedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[4].payload",
      "DispositionDecidedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[5].payload",
      "ReturnLineStagedEvent": "$ref:$.channels.warehouse.returns-processing.events.subscribe.message.oneOf[6].payload",
      "ProductClassifiedEvent": "$ref:$.channels.warehouse.product-master.events.publish.message.payload",
      "AllocatedLine": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data.properties.lines.items",
      "OrderAllocatedEvent": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[0].payload",
      "OrderPartiallyAllocatedEvent": "$ref:$.channels.warehouse.order-management.events.publish.message.oneOf[1].payload",
      "PackageManifestedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.payload"
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
  