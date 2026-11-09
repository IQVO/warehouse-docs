
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "outbound-shipping Domain Events",
    "version": "1.0.0",
    "contact": {
      "name": "outbound-shipping maintainers",
      "url": "https://github.com/IQVO/outbound-shipping",
      "email": "outbound-shipping@iqvo.example.com"
    },
    "license": {
      "name": "UNLICENSED"
    },
    "description": "Event contract for the **outbound-shipping** bounded context (WMS\nsubdomain): staging, the outbound load, ship-confirm on the trailer's\nphysical departure, and the bill of lading (ADR 0001, ADR 0002, ADR\n0005).\n\n**Published.** Three aggregates raise thirteen events, published to\n`warehouse.outbound-shipping.events` through a **transactional outbox**:\nthe aggregate row and its already-encoded events are written in ONE\ndatabase transaction and a relay drains them to Kafka (at-least-once; the\nCloudEvents `id` is stored with the outbox row, so a retry republishes\nthe same `id`). Every payload carries the aggregate `version` AFTER the\nchange, so consumers can reject out-of-order deliveries.\n\n**Analytics.** Every published event is ALSO written, in the same\ntransaction and under the same `id`, to\n`warehouse.outbound-shipping.analytics` with\n`dataschema urn:warehouse:outbound-shipping:analytics:<EventName>:v1`.\nThat stream is not an integration contract: only this service's own\nprojector consumes it. Other contexts keep reading\n`warehouse.outbound-shipping.events`.\n\n**Consumed (ADR 0003, ADR 0005).** `PackageManifested` and\n`PackageDiverted` from fulfillment-execution; `CPTScheduleChanged` from\nprocess-path-management; `ZoneRegistered` and `LocationSlotRegistered`\nfrom facility-layout; `DockAppointmentBooked` from dock-scheduling\n(pinned from its `origin/feature/service` until that contract merges);\n`TrailerDocked`, `DoorWorkCompleted` and `TrailerDeparted` from\nyard-management (pinned to its merged contract,\n`contracts/yard-management.asyncapi.yaml`, ADR 0010 there). Each feeds a durable local copy. The consumed\nmessages below are the producers' own contracts, decoded independently\nhere and never imported.\n\n**Envelope (mandatory).** CloudEvents 1.0, structured content mode, Kafka\nheader `content-type: application/cloudevents+json; charset=UTF-8`.\n`type` = `com.warehouse.wms.outbound-shipping.<entity>.<EventName>`\nwhere `<entity>` is the raising aggregate lowercase with no separators:\n`outboundload`, `shippingpackage`, `billoflading`. Kafka key = aggregate\nid. Dispatch on the full `type`, ignore unknown types, dedupe on `id`.\n"
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
  "tags": [
    {
      "name": "outbound-shipping",
      "description": "The outbound-shipping bounded context (WMS subdomain)."
    },
    {
      "name": "outboundload",
      "description": "Events raised by the OutboundLoad aggregate."
    },
    {
      "name": "shippingpackage",
      "description": "Events raised by the ShippingPackage aggregate."
    },
    {
      "name": "billoflading",
      "description": "Events raised by the BillOfLading aggregate."
    },
    {
      "name": "consumed",
      "description": "Events produced by sibling contexts that this service consumes (ADR 0003, ADR 0005)."
    },
    {
      "name": "analytics",
      "description": "This service's own analytics stream (every published event, same id)."
    }
  ],
  "defaultContentType": "application/json",
  "channels": {
    "warehouse.outbound-shipping.events": {
      "description": "This service's integration topic. Written by the outbox relay; key =\naggregate id, so all events of one load (or package, or BOL) stay\nordered on one partition. Every message carries the CloudEvents\ncontent-type header. Dispatch on the full `type`, ignore unknown\ntypes, dedupe on `id`.\n",
      "subscribe": {
        "operationId": "receiveOutboundShippingEvents",
        "summary": "Receive outbound-shipping events.",
        "description": "Subscribe to the outbound shipping facts. Route on the full `type`\n(`com.warehouse.wms.outbound-shipping.<entity>.<EventName>`).\n`ShipmentConfirmed` is the fleet's \"this actually shipped\" fact\n(ADR 0002, ADR 0004); `PackageMissedLoad` drives exception cases and\nre-promising.\n",
        "tags": [
          {
            "name": "outbound-shipping"
          }
        ],
        "message": {
          "oneOf": [
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "LoadPlanned",
              "title": "Load planned",
              "summary": "A load was planned for one cutoff and ship method.",
              "description": "`type` = `com.warehouse.wms.outbound-shipping.outboundload.LoadPlanned`;\nsubject and key = the load id. Raised automatically when the first\npackage of a (site, cpt, date, ship method) manifests and no open\nload exists for that key (PlanLoadFromCutoff policy).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
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
                        "description": "UUID minted once per occurrence and persisted with the outbox row; consumers dedupe on it.",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/outbound-shipping",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "com.warehouse.wms.outbound-shipping.<entity>.<EventName>.",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "description": "Aggregate root id; also the Kafka partition key.",
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
                        "description": "urn:warehouse:outbound-shipping:<events|analytics>:<EventName>:v1.",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventEnvelope"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadPlanned",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadPlanned:v1",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "cpt_id",
                          "operating_date",
                          "ship_method",
                          "cutoff",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "cpt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "operating_date": {
                            "type": "string",
                            "format": "date",
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "ship_method": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          },
                          "cutoff": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                ],
                "x-parser-schema-id": "LoadPlannedEvent"
              },
              "examples": [
                {
                  "name": "planned",
                  "summary": "The first package of the 16:00 ground cutoff plans load load-7f3a.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e01",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadPlanned",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T13:02:11Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadPlanned:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "cpt_id": "cpt-1600",
                      "operating_date": "2026-11-06",
                      "ship_method": "STDOUT-2DAY",
                      "cutoff": "2026-11-06T16:00:00Z",
                      "version": 1
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "LoadDoorAssigned",
              "title": "Load door assigned",
              "summary": "An outbound dock appointment assigned the load's door.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.LoadDoorAssigned`;\nsubject and key = the load id. DoorFromAppointment policy: the\nappointment names the cpt; `appointment_id` is that appointment.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadDoorAssigned",
                        "x-parser-schema-id": "<anonymous-schema-21>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadDoorAssigned:v1",
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "door_code",
                          "appointment_id",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-24>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-25>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          },
                          "appointment_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-27>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-28>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-20>"
                  }
                ],
                "x-parser-schema-id": "LoadDoorAssignedEvent"
              },
              "examples": [
                {
                  "name": "assigned",
                  "summary": "Appointment appt-2211 assigns door D04 to load-7f3a.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e02",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadDoorAssigned",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T13:20:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadDoorAssigned:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "door_code": "D04",
                      "appointment_id": "appt-2211",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "pending: ADR 0005 names yard-management as the integration consumer, but yard-management declares no such consumer and has no handler for it on develop.",
              "name": "LoadingStarted",
              "title": "Loading started",
              "summary": "Loading began at the assigned door with the docked trailer.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.LoadingStarted`;\nsubject and key = the load id. Requires a door AND a docked trailer\n(`ErrTrailerNotDocked`). yard-management starts its outbound door\nwork on it (wave 6.4, deferred until the yard contract merges).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadingStarted",
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadingStarted:v1",
                        "x-parser-schema-id": "<anonymous-schema-31>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "door_code",
                          "trailer_id",
                          "started_at",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-33>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-34>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-35>"
                          },
                          "trailer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "started_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-32>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-29>"
                  }
                ],
                "x-parser-schema-id": "LoadingStartedEvent"
              },
              "examples": [
                {
                  "name": "started",
                  "summary": "Trailer trl-91 docks at D04 and loading starts.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e03",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadingStarted",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T14:05:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadingStarted:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "door_code": "D04",
                      "trailer_id": "trl-91",
                      "started_at": "2026-11-06T14:05:00Z",
                      "version": 3
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "pending: ADR 0005 names yard-management as the integration consumer, but yard-management declares no such consumer and has no handler for it on develop.",
              "name": "LoadClosed",
              "title": "Load closed",
              "summary": "Every package is loaded or short-shipped; the load is closed.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.LoadClosed`;\nsubject and key = the load id. `package_count` is the loaded count,\n`short_shipped_count` the deliberate left-offs with reasons.\nyard-management completes its outbound door work on it.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadClosed",
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadClosed:v1",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "door_code",
                          "trailer_id",
                          "package_count",
                          "short_shipped_count",
                          "closed_at",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-43>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-44>"
                          },
                          "door_code": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-45>"
                          },
                          "trailer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-46>"
                          },
                          "package_count": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          },
                          "short_shipped_count": {
                            "type": "integer",
                            "minimum": 0,
                            "x-parser-schema-id": "<anonymous-schema-48>"
                          },
                          "closed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-49>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-50>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-39>"
                  }
                ],
                "x-parser-schema-id": "LoadClosedEvent"
              },
              "examples": [
                {
                  "name": "closed",
                  "summary": "Load-7f3a closes with 40 loaded packages and one short-ship.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e04",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadClosed",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T15:41:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadClosed:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "door_code": "D04",
                      "trailer_id": "trl-91",
                      "package_count": 40,
                      "short_shipped_count": 1,
                      "closed_at": "2026-11-06T15:41:00Z",
                      "version": 4
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "pending: ADR 0005 names yard-management as the integration consumer, but yard-management declares no such consumer and has no handler for it on develop.",
              "name": "LoadReopened",
              "title": "Load reopened",
              "summary": "A supervisor reopened a closed load for more loading.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.LoadReopened`;\nsubject and key = the load id. A SHIP_CONFIRMED load is never\nreopened (`ErrLoadConfirmed`). yard-management reopens the door work\non it.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadReopened",
                        "x-parser-schema-id": "<anonymous-schema-52>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadReopened:v1",
                        "x-parser-schema-id": "<anonymous-schema-53>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "reopened_at",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-55>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-56>"
                          },
                          "reopened_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-58>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-51>"
                  }
                ],
                "x-parser-schema-id": "LoadReopenedEvent"
              },
              "examples": [
                {
                  "name": "reopened",
                  "summary": "Load-7f3a reopens for a late package.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e05",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadReopened",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T15:44:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadReopened:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "reopened_at": "2026-11-06T15:44:00Z",
                      "version": 5
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "LoadCancelled",
              "title": "Load cancelled",
              "summary": "A planned load was cancelled before loading.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.LoadCancelled`;\nsubject and key = the load id. Only a PLANNED load can be cancelled.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.LoadCancelled",
                        "x-parser-schema-id": "<anonymous-schema-60>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:LoadCancelled:v1",
                        "x-parser-schema-id": "<anonymous-schema-61>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "cancelled_at",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-63>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-64>"
                          },
                          "cancelled_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-65>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-66>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  }
                ],
                "x-parser-schema-id": "LoadCancelledEvent"
              },
              "examples": [
                {
                  "name": "cancelled",
                  "summary": "The cutoff was withdrawn before any package loaded.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e06",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.LoadCancelled",
                    "subject": "load-9c2b",
                    "time": "2026-11-06T12:10:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:LoadCancelled:v1",
                    "data": {
                      "load_id": "load-9c2b",
                      "site_id": "SITE-1",
                      "cancelled_at": "2026-11-06T12:10:00Z",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "name": "ShipmentConfirmed",
              "title": "Shipment confirmed",
              "summary": "The trailer left with a closed load; the shipment is a fact.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.outboundload.ShipmentConfirmed`;\nsubject and key = the load id. Raised on `TrailerDeparted` for a\nCLOSED load (ADR 0002): the goods physically left. `orders` lists\nevery distinct `source_order_id` of the shipped packages (ADR 0003);\na package manifested without one is excluded. order-management marks\norders Shipped/PartiallyShipped (D7) and network-fulfillment joins\n`localOrderId` (ADR 0004).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "outboundload"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.outboundload.ShipmentConfirmed",
                        "x-parser-schema-id": "<anonymous-schema-68>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:ShipmentConfirmed:v1",
                        "x-parser-schema-id": "<anonymous-schema-69>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "load_id",
                          "site_id",
                          "cpt_id",
                          "carrier",
                          "trailer_id",
                          "seal_number",
                          "departed_at",
                          "orders",
                          "version"
                        ],
                        "properties": {
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-71>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-72>"
                          },
                          "cpt_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-73>"
                          },
                          "carrier": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-74>"
                          },
                          "trailer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-75>"
                          },
                          "seal_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-76>"
                          },
                          "departed_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-77>"
                          },
                          "orders": {
                            "type": "array",
                            "description": "Distinct source_order_id of the shipped packages (ADR 0003); a package manifested without one is excluded.",
                            "items": {
                              "type": "object",
                              "required": [
                                "order_id"
                              ],
                              "properties": {
                                "order_id": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-80>"
                                }
                              },
                              "x-parser-schema-id": "<anonymous-schema-79>"
                            },
                            "x-parser-schema-id": "<anonymous-schema-78>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-81>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-70>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-67>"
                  }
                ],
                "x-parser-schema-id": "ShipmentConfirmedEvent"
              },
              "examples": [
                {
                  "name": "confirmed",
                  "summary": "Trailer trl-91 departs with load-7f3a, seal SL-4471, two orders.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e07",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.outboundload.ShipmentConfirmed",
                    "subject": "load-7f3a",
                    "time": "2026-11-06T16:02:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:ShipmentConfirmed:v1",
                    "data": {
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "cpt_id": "cpt-1600",
                      "carrier": "STDOUT",
                      "trailer_id": "trl-91",
                      "seal_number": "SL-4471",
                      "departed_at": "2026-11-06T16:01:30Z",
                      "orders": [
                        {
                          "order_id": "order-88421"
                        },
                        {
                          "order_id": "order-88422"
                        }
                      ],
                      "version": 6
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "PackageStaged",
              "title": "Package staged",
              "summary": "A manifested package was staged at a Staging location.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.shippingpackage.PackageStaged`;\nsubject and key = the package id. The location is a facility-layout\nStaging location of the package's site.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shippingpackage"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageStaged",
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:PackageStaged:v1",
                        "x-parser-schema-id": "<anonymous-schema-84>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "load_id",
                          "site_id",
                          "staging_location",
                          "staged_at",
                          "version"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-86>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-87>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-88>"
                          },
                          "staging_location": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-89>"
                          },
                          "staged_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-91>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-85>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-82>"
                  }
                ],
                "x-parser-schema-id": "PackageStagedEvent"
              },
              "examples": [
                {
                  "name": "staged",
                  "summary": "pkg-1029 stages at STG-D04-A.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e08",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageStaged",
                    "subject": "pkg-1029",
                    "time": "2026-11-06T14:20:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:PackageStaged:v1",
                    "data": {
                      "package_id": "pkg-1029",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "staging_location": "STG-D04-A",
                      "staged_at": "2026-11-06T14:20:00Z",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "PackageLoaded",
              "title": "Package loaded",
              "summary": "A package was loaded onto its load through the load's door.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.shippingpackage.PackageLoaded`;\nsubject and key = the package id.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shippingpackage"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageLoaded",
                        "x-parser-schema-id": "<anonymous-schema-93>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:PackageLoaded:v1",
                        "x-parser-schema-id": "<anonymous-schema-94>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "load_id",
                          "site_id",
                          "loaded_at",
                          "version"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-96>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-97>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-98>"
                          },
                          "loaded_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-100>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-95>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-92>"
                  }
                ],
                "x-parser-schema-id": "PackageLoadedEvent"
              },
              "examples": [
                {
                  "name": "loaded",
                  "summary": "pkg-1029 loads through door D04 onto load-7f3a.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e09",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageLoaded",
                    "subject": "pkg-1029",
                    "time": "2026-11-06T14:48:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:PackageLoaded:v1",
                    "data": {
                      "package_id": "pkg-1029",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "loaded_at": "2026-11-06T14:48:00Z",
                      "version": 3
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "PackageUnloaded",
              "title": "Package unloaded",
              "summary": "A loaded package came back off the load before ship-confirm.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.shippingpackage.PackageUnloaded`;\nsubject and key = the package id. `reason` is the operator's reason,\nomitted when none was given. Impossible after ship-confirm\n(`ErrAlreadyShipped`).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shippingpackage"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageUnloaded",
                        "x-parser-schema-id": "<anonymous-schema-102>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:PackageUnloaded:v1",
                        "x-parser-schema-id": "<anonymous-schema-103>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "load_id",
                          "site_id",
                          "unloaded_at",
                          "version"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-105>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-106>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-107>"
                          },
                          "unloaded_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-108>"
                          },
                          "reason": {
                            "type": "string",
                            "description": "Operator's reason, omitted when none was given.",
                            "x-parser-schema-id": "<anonymous-schema-109>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-110>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-104>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-101>"
                  }
                ],
                "x-parser-schema-id": "PackageUnloadedEvent"
              },
              "examples": [
                {
                  "name": "unloaded",
                  "summary": "pkg-1029 comes back off with a damaged carton.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e0a",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageUnloaded",
                    "subject": "pkg-1029",
                    "time": "2026-11-06T15:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:PackageUnloaded:v1",
                    "data": {
                      "package_id": "pkg-1029",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "unloaded_at": "2026-11-06T15:00:00Z",
                      "reason": "damaged-carton",
                      "version": 4
                    }
                  }
                }
              ]
            },
            {
              "name": "PackageMissedLoad",
              "title": "Package missed its load",
              "summary": "A package was not loaded by its cutoff or by departure.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.shippingpackage.PackageMissedLoad`;\nsubject and key = the package id. Raised at most ONCE per package and\nload (the flagged fact is remembered: a re-run sweep or a repeated\ndeparture publishes nothing new). `source_order_id` is omitted when\nthe manifest carried none (ADR 0003). exception-management opens a\ncase; order-management re-promises.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "shippingpackage"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageMissedLoad",
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:PackageMissedLoad:v1",
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "package_id",
                          "load_id",
                          "site_id",
                          "cutoff",
                          "detected_at",
                          "version"
                        ],
                        "properties": {
                          "package_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-115>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-116>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-117>"
                          },
                          "source_order_id": {
                            "type": "string",
                            "description": "Omitted when the manifest carried none (ADR 0003).",
                            "x-parser-schema-id": "<anonymous-schema-118>"
                          },
                          "cutoff": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-119>"
                          },
                          "detected_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-120>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-121>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-114>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-111>"
                  }
                ],
                "x-parser-schema-id": "PackageMissedLoadEvent"
              },
              "examples": [
                {
                  "name": "missed",
                  "summary": "The 16:00 cutoff passes with pkg-2055 still staged.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e0b",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.shippingpackage.PackageMissedLoad",
                    "subject": "pkg-2055",
                    "time": "2026-11-06T16:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:PackageMissedLoad:v1",
                    "data": {
                      "package_id": "pkg-2055",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "source_order_id": "order-88423",
                      "cutoff": "2026-11-06T16:00:00Z",
                      "detected_at": "2026-11-06T16:00:00Z",
                      "version": 2
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "BillOfLadingIssued",
              "title": "Bill of lading issued",
              "summary": "The shipping document of one confirmed load was issued.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingIssued`;\nsubject and key = the BOL number. Issued exactly once per\nSHIP_CONFIRMED load (`ErrBolAlreadyIssued`) with the seal the\ndeparture carried (`ErrSealMissing` without one).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "billoflading"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingIssued",
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:BillOfLadingIssued:v1",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "bol_number",
                          "load_id",
                          "site_id",
                          "carrier",
                          "trailer_id",
                          "seal_number",
                          "package_count",
                          "total_weight_g",
                          "issued_at",
                          "version"
                        ],
                        "properties": {
                          "bol_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-126>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-128>"
                          },
                          "carrier": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-129>"
                          },
                          "trailer_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-130>"
                          },
                          "seal_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-131>"
                          },
                          "package_count": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-132>"
                          },
                          "total_weight_g": {
                            "type": "number",
                            "minimum": 0,
                            "description": "Sum of the shipped packages' weight_g; 0 when none carried one.",
                            "x-parser-schema-id": "<anonymous-schema-133>"
                          },
                          "issued_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-134>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-135>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  }
                ],
                "x-parser-schema-id": "BillOfLadingIssuedEvent"
              },
              "examples": [
                {
                  "name": "issued",
                  "summary": "BOL for load-7f3a, 40 packages, 412.5 kg.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e0c",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingIssued",
                    "subject": "BOL-2026-11-06-0042",
                    "time": "2026-11-06T16:02:01Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:BillOfLadingIssued:v1",
                    "data": {
                      "bol_number": "BOL-2026-11-06-0042",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "carrier": "STDOUT",
                      "trailer_id": "trl-91",
                      "seal_number": "SL-4471",
                      "package_count": 40,
                      "total_weight_g": 412500,
                      "issued_at": "2026-11-06T16:02:01Z",
                      "version": 1
                    }
                  }
                }
              ]
            },
            {
              "x-no-consumer-reason": "No integration consumer by design: the ADR 0005 type catalogue lists this type as analytics only; the service's own projector folds it from the analytics stream.",
              "name": "BillOfLadingVoided",
              "title": "Bill of lading voided",
              "summary": "An issued bill of lading was voided.",
              "description": "`type` =\n`com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingVoided`;\nsubject and key = the BOL number. A supervisor decision (e.g. a\nre-issued document); the shipment itself is not undone.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "billoflading"
                }
              ],
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingVoided",
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      },
                      "dataschema": {
                        "type": "string",
                        "const": "urn:warehouse:outbound-shipping:events:BillOfLadingVoided:v1",
                        "x-parser-schema-id": "<anonymous-schema-138>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "bol_number",
                          "load_id",
                          "site_id",
                          "reason",
                          "voided_at",
                          "version"
                        ],
                        "properties": {
                          "bol_number": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-140>"
                          },
                          "load_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-141>"
                          },
                          "site_id": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-142>"
                          },
                          "reason": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          },
                          "voided_at": {
                            "type": "string",
                            "format": "date-time",
                            "x-parser-schema-id": "<anonymous-schema-144>"
                          },
                          "version": {
                            "type": "integer",
                            "minimum": 1,
                            "x-parser-schema-id": "<anonymous-schema-145>"
                          }
                        },
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-136>"
                  }
                ],
                "x-parser-schema-id": "BillOfLadingVoidedEvent"
              },
              "examples": [
                {
                  "name": "voided",
                  "summary": "The carrier rejected the print; the document is voided for re-issue.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "3f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e0d",
                    "source": "/warehouse/outbound-shipping",
                    "type": "com.warehouse.wms.outbound-shipping.billoflading.BillOfLadingVoided",
                    "subject": "BOL-2026-11-06-0042",
                    "time": "2026-11-06T16:30:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:outbound-shipping:events:BillOfLadingVoided:v1",
                    "data": {
                      "bol_number": "BOL-2026-11-06-0042",
                      "load_id": "load-7f3a",
                      "site_id": "SITE-1",
                      "reason": "reprint-for-carrier",
                      "voided_at": "2026-11-06T16:30:00Z",
                      "version": 2
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    },
    "warehouse.outbound-shipping.analytics": {
      "description": "This service's own analytics stream, written by the SAME transactional\noutbox as the integration topic: every published event appears here\ntoo, under the SAME CloudEvents id and `type`, with only the\n`dataschema` stream segment different\n(`urn:warehouse:outbound-shipping:analytics:<EventName>:v1`). It is\nNOT an integration contract: the only consumer is this service's own\nprojector. Other contexts keep reading\n`warehouse.outbound-shipping.events`.\n",
      "subscribe": {
        "operationId": "receiveOutboundShippingAnalytics",
        "summary": "Receive the analytics twin of every outbound-shipping event.",
        "description": "Payloads are byte-for-byte the integration payloads; only the\n`dataschema` stream segment differs. Consumed by this service's\nprojector (fixed consumer group) to fold the load funnel and\nadherence read models.\n",
        "tags": [
          {
            "name": "analytics"
          }
        ],
        "message": {
          "oneOf": [
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[1]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[2]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[3]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[4]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[5]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[6]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[7]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[8]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[9]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[10]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[11]",
            "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[12]"
          ]
        }
      }
    },
    "warehouse.fulfillment.events": {
      "description": "fulfillment-execution's integration topic. This service consumes ONLY\n`PackageManifested` and `PackageDiverted` (keyed by package id, so one\npackage's stream is totally ordered), under a stable consumer group.\nEvery other type on the topic is ignored.\n",
      "publish": {
        "operationId": "consumeFulfillmentPackageEvents",
        "summary": "Consume package manifestation and diversion.",
        "description": "`PackageManifested` plans the load (PlanLoadFromCutoff policy) and\nrecords the package as EXPECTED on it (AssignPackageToLoad). The\nadditive correlation fields `site_id`, `source_order_id`, `cpt`,\n`weight_g` (ADR 0003) are optional and omitted by the producer when\nunknown — this consumer tolerates both shapes. `PackageDiverted`\nshort-ships an EXPECTED package with reason DIVERTED (DropDiverted\npolicy). The CloudEvents `id` claim and the effect commit in one\ntransaction; the offset is committed afterwards.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "PackageManifested",
              "title": "PackageManifested (consumed)",
              "summary": "fulfillment-execution's package manifestation; plans the load and expects the package.",
              "description": "Producer contract (fulfillment-execution, `origin/develop`). The four\nship-correlation fields are ADDITIVE per ADR 0003, pinned from the\nproducer's wave-2 branch and optional (`omitempty`): `site_id` is\nomitted today (no source in the chain yet), `source_order_id`,\n`cpt` and `weight_g` flow once the producer stamps them. This\nconsumer tolerates both shapes and never parses `order_ref`.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-146>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-147>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/fulfillment-execution",
                    "x-parser-schema-id": "<anonymous-schema-148>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
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
                    "x-parser-schema-id": "<anonymous-schema-152>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-153>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "package_id",
                      "order_ref"
                    ],
                    "properties": {
                      "package_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-155>"
                      },
                      "order_ref": {
                        "type": "string",
                        "description": "Stored verbatim, never parsed (ADR 0003).",
                        "x-parser-schema-id": "<anonymous-schema-156>"
                      },
                      "site_id": {
                        "type": "string",
                        "description": "Additive (ADR 0003); omitted today — no source in the chain yet.",
                        "x-parser-schema-id": "<anonymous-schema-157>"
                      },
                      "source_order_id": {
                        "type": "string",
                        "description": "Additive (ADR 0003); the order-management OrderId.",
                        "x-parser-schema-id": "<anonymous-schema-158>"
                      },
                      "cpt": {
                        "type": "string",
                        "description": "Additive (ADR 0003); RFC 3339 instant of the owning cutoff.",
                        "x-parser-schema-id": "<anonymous-schema-159>"
                      },
                      "weight_g": {
                        "type": "number",
                        "description": "Additive (ADR 0003); actual SLAM weight in grams.",
                        "x-parser-schema-id": "<anonymous-schema-160>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-154>"
                  }
                },
                "x-parser-schema-id": "PackageManifestedEvent"
              },
              "examples": [
                {
                  "name": "manifested",
                  "summary": "pkg-1029 manifests with its order correlation.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageManifested",
                    "subject": "pkg-1029",
                    "time": "2026-11-06T13:02:10Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:PackageManifested:v1",
                    "data": {
                      "package_id": "pkg-1029",
                      "order_ref": "order-88421-line-1",
                      "source_order_id": "order-88421",
                      "cpt": "2026-11-06T16:00:00Z",
                      "weight_g": 10300
                    }
                  }
                }
              ]
            },
            {
              "name": "PackageDiverted",
              "title": "PackageDiverted (consumed)",
              "summary": "fulfillment-execution diverted a package; an EXPECTED package becomes SHORT_SHIPPED (DIVERTED).",
              "description": "Producer contract (fulfillment-execution, `origin/develop`). The\nDropDiverted policy: an EXPECTED package of an open load is\nshort-shipped with reason DIVERTED so the load can still close.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-161>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-162>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/fulfillment-execution",
                    "x-parser-schema-id": "<anonymous-schema-163>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wes.fulfillment-execution.package.PackageDiverted",
                    "x-parser-schema-id": "<anonymous-schema-164>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-165>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-166>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-167>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-168>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "package_id"
                    ],
                    "properties": {
                      "package_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-170>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-169>"
                  }
                },
                "x-parser-schema-id": "PackageDivertedEvent"
              },
              "examples": [
                {
                  "name": "diverted",
                  "summary": "pkg-2077 fails its weigh-check and is diverted.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c",
                    "source": "/warehouse/fulfillment-execution",
                    "type": "com.warehouse.wes.fulfillment-execution.package.PackageDiverted",
                    "subject": "pkg-2077",
                    "time": "2026-11-06T13:40:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:fulfillment-execution:events:PackageDiverted:v1",
                    "data": {
                      "package_id": "pkg-2077"
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
      "description": "process-path-management's integration topic. This service consumes\nONLY `CPTScheduleChanged` (keyed by site id), which feeds the local\nCPT copy the load planner reads. Every other type on the topic is\nignored.\n",
      "publish": {
        "operationId": "consumeCptSchedule",
        "summary": "Consume the cutoff (CPT) schedule.",
        "description": "Last writer wins per site: the local copy keeps each cutoff's id,\nlocal time, days of week and ship method — the (site, cpt, date,\nship method) key a load is planned for. A cutoff that disappears\nfrom the schedule leaves the local copy stale until the next change;\nthat is recorded, not guessed.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "CPTScheduleChanged",
          "title": "CPTScheduleChanged (consumed)",
          "summary": "process-path-management's cutoff schedule; feeds the local CPT copy.",
          "description": "Producer contract (process-path-management, `origin/develop`). The\nlocal copy keeps each cutoff's id, local time, days of week and ship\nmethod — the (site, cpt, date, ship method) key a load is planned\nfor. Last writer wins per site.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "type": "object",
            "required": [
              "specversion",
              "id",
              "source",
              "type",
              "datacontenttype",
              "data"
            ],
            "properties": {
              "specversion": {
                "type": "string",
                "const": "1.0",
                "x-parser-schema-id": "<anonymous-schema-171>"
              },
              "id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-172>"
              },
              "source": {
                "type": "string",
                "const": "/warehouse/process-path-management",
                "x-parser-schema-id": "<anonymous-schema-173>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                "x-parser-schema-id": "<anonymous-schema-174>"
              },
              "subject": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-175>"
              },
              "time": {
                "type": "string",
                "format": "date-time",
                "x-parser-schema-id": "<anonymous-schema-176>"
              },
              "datacontenttype": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-177>"
              },
              "dataschema": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-178>"
              },
              "data": {
                "type": "object",
                "required": [
                  "site_id",
                  "timezone",
                  "cutoffs"
                ],
                "properties": {
                  "site_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-180>"
                  },
                  "timezone": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-181>"
                  },
                  "cutoffs": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "required": [
                        "cpt_id",
                        "local_time",
                        "days_of_week",
                        "ship_method"
                      ],
                      "properties": {
                        "cpt_id": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-184>"
                        },
                        "local_time": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-185>"
                        },
                        "days_of_week": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-187>"
                          },
                          "x-parser-schema-id": "<anonymous-schema-186>"
                        },
                        "ship_method": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-188>"
                        },
                        "eligible_path_ids": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "x-parser-schema-id": "<anonymous-schema-190>"
                          },
                          "x-parser-schema-id": "<anonymous-schema-189>"
                        }
                      },
                      "x-parser-schema-id": "<anonymous-schema-183>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-182>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-179>"
              }
            },
            "x-parser-schema-id": "CPTScheduleChangedEvent"
          },
          "examples": [
            {
              "name": "schedule",
              "summary": "SITE-1's schedule with one 16:00 ground cutoff.",
              "payload": {
                "specversion": "1.0",
                "id": "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
                "source": "/warehouse/process-path-management",
                "type": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                "subject": "SITE-1",
                "time": "2026-11-01T00:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:process-path-management:events:CPTScheduleChanged:v1",
                "data": {
                  "site_id": "SITE-1",
                  "timezone": "America/Sao_Paulo",
                  "cutoffs": [
                    {
                      "cpt_id": "cpt-1600",
                      "local_time": "13:00",
                      "days_of_week": [
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri"
                      ],
                      "ship_method": "STDOUT-2DAY",
                      "eligible_path_ids": [
                        "PICK",
                        "PACK"
                      ]
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.facility.events": {
      "description": "facility-layout's integration topic. This service consumes ONLY\n`ZoneRegistered` (zone to site mapping) and `LocationSlotRegistered`\n(staging locations). Every other type on the topic is ignored.\n",
      "publish": {
        "operationId": "consumeFacilityLayout",
        "summary": "Consume zones and staging locations.",
        "description": "Feeds the staging-location local copy: a package stages only at a\nlocation whose `role` is Staging in a zone of its site\n(`ErrNotStagingLocation`). A location maps to a site through its\n`zoneId`, never by parsing its code. `role` is absent on events\nemitted before the field existed (treated as Storage, so never\nStaging).\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ZoneRegistered",
              "title": "ZoneRegistered (consumed)",
              "summary": "facility-layout zone registration; feeds the zone-to-site mapping.",
              "description": "Producer contract (facility-layout, `origin/develop`). A location\nmaps to a site via its `zoneId` through this copy — never by parsing\na location code (the site_key convention).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-191>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-192>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/facility-layout",
                    "x-parser-schema-id": "<anonymous-schema-193>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.facility-layout.zone.ZoneRegistered",
                    "x-parser-schema-id": "<anonymous-schema-194>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-195>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-196>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-197>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-198>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "zoneId",
                      "siteCode",
                      "zoneCode"
                    ],
                    "properties": {
                      "zoneId": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-200>"
                      },
                      "siteCode": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-201>"
                      },
                      "areaCode": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-202>"
                      },
                      "zoneCode": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-203>"
                      },
                      "temperatureClass": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-204>"
                      },
                      "hazmat": {
                        "type": "boolean",
                        "x-parser-schema-id": "<anonymous-schema-205>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-199>"
                  }
                },
                "x-parser-schema-id": "ZoneRegisteredEvent"
              },
              "examples": [
                {
                  "name": "zone",
                  "summary": "Zone Z-D04 of site SITE-1.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.zone.ZoneRegistered",
                    "subject": "Z-D04",
                    "time": "2026-10-01T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:ZoneRegistered:v1",
                    "data": {
                      "zoneId": "Z-D04",
                      "siteCode": "SITE-1",
                      "areaCode": "A-OUT",
                      "zoneCode": "D04",
                      "temperatureClass": "Ambient",
                      "hazmat": false
                    }
                  }
                }
              ]
            },
            {
              "name": "LocationSlotRegistered",
              "title": "LocationSlotRegistered (consumed)",
              "summary": "facility-layout location registration; feeds the staging-location copy.",
              "description": "Producer contract (facility-layout, `origin/develop`). Only locations\nwhose `role` is Staging can hold a staged package\n(`ErrNotStagingLocation`); `role` is absent on pre-role events and\ntreated as Storage. `zoneId` joins the zone-to-site copy.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-206>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-207>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/facility-layout",
                    "x-parser-schema-id": "<anonymous-schema-208>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                    "x-parser-schema-id": "<anonymous-schema-209>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-210>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-211>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-212>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-213>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "locationCode",
                      "zoneId",
                      "locationType",
                      "role"
                    ],
                    "properties": {
                      "locationCode": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-215>"
                      },
                      "aisleId": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-216>"
                      },
                      "zoneId": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-217>"
                      },
                      "locationType": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-218>"
                      },
                      "role": {
                        "type": "string",
                        "description": "LocationRole (ADR-0016 of the producer); absent on pre-role events, treated as Storage.",
                        "x-parser-schema-id": "<anonymous-schema-219>"
                      },
                      "dockFlow": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-220>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-214>"
                  }
                },
                "x-parser-schema-id": "LocationSlotRegisteredEvent"
              },
              "examples": [
                {
                  "name": "stagingSlot",
                  "summary": "Staging location STG-D04-A in zone Z-D04.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6e",
                    "source": "/warehouse/facility-layout",
                    "type": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                    "subject": "STG-D04-A",
                    "time": "2026-10-01T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:facility-layout:events:LocationSlotRegistered:v1",
                    "data": {
                      "locationCode": "STG-D04-A",
                      "aisleId": "A-07",
                      "zoneId": "Z-D04",
                      "locationType": "FLOOR",
                      "role": "Staging"
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
      "description": "dock-scheduling's integration topic. This service consumes ONLY\n`DockAppointmentBooked` with `direction=OUTBOUND` (DoorFromAppointment\npolicy: an appointment naming the load's cpt assigns the door).\n`cpt_id` and `carrier_scac` are nullable — an appointment without a\ncpt names no load. PINNED from the producer's\n`origin/feature/service` (campaign spike Q5): re-verify against the\nproducer's `origin/develop` AsyncAPI before fleet wiring lands.\n",
      "publish": {
        "operationId": "consumeDockAppointments",
        "summary": "Consume outbound dock appointments.",
        "description": "INBOUND appointments are ignored. An OUTBOUND appointment carrying a\n`cpt_id` assigns the door to the open load of that (site, cpt,\ndate, ship method), if one exists when the event arrives; a later\nappointment for the same cpt re-assigns and the change is published\nas `LoadDoorAssigned` again.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "name": "DockAppointmentBooked",
          "title": "DockAppointmentBooked (consumed)",
          "summary": "dock-scheduling's appointment booking; an OUTBOUND appointment names the cpt and assigns the door.",
          "description": "PINNED from dock-scheduling's `origin/feature/service` (campaign\nspike Q5) — its develop contract does not exist yet; re-pin before\nfleet wiring. Only `direction=OUTBOUND` is acted on. `cpt_id` and\n`carrier_scac` are nullable: an appointment without a cpt names no\nload. `expected_seal_number` is nullable.\n",
          "contentType": "application/cloudevents+json",
          "tags": [
            {
              "name": "consumed"
            }
          ],
          "payload": {
            "type": "object",
            "required": [
              "specversion",
              "id",
              "source",
              "type",
              "datacontenttype",
              "data"
            ],
            "properties": {
              "specversion": {
                "type": "string",
                "const": "1.0",
                "x-parser-schema-id": "<anonymous-schema-221>"
              },
              "id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-222>"
              },
              "source": {
                "type": "string",
                "const": "/warehouse/dock-scheduling",
                "x-parser-schema-id": "<anonymous-schema-223>"
              },
              "type": {
                "type": "string",
                "const": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked",
                "x-parser-schema-id": "<anonymous-schema-224>"
              },
              "subject": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-225>"
              },
              "time": {
                "type": "string",
                "format": "date-time",
                "x-parser-schema-id": "<anonymous-schema-226>"
              },
              "datacontenttype": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-227>"
              },
              "dataschema": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-228>"
              },
              "data": {
                "type": "object",
                "required": [
                  "appointment_id",
                  "site_id",
                  "direction",
                  "door_code",
                  "carrier",
                  "version"
                ],
                "properties": {
                  "appointment_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-230>"
                  },
                  "site_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-231>"
                  },
                  "direction": {
                    "type": "string",
                    "enum": [
                      "INBOUND",
                      "OUTBOUND"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-232>"
                  },
                  "door_code": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-233>"
                  },
                  "carrier": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-234>"
                  },
                  "carrier_scac": {
                    "type": [
                      "string",
                      "null"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-235>"
                  },
                  "cpt_id": {
                    "type": [
                      "string",
                      "null"
                    ],
                    "description": "Nullable; an appointment without a cpt names no load.",
                    "x-parser-schema-id": "<anonymous-schema-236>"
                  },
                  "window_start": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-237>"
                  },
                  "window_end": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-238>"
                  },
                  "asn_numbers": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-240>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-239>"
                  },
                  "shipment_refs": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-242>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-241>"
                  },
                  "expected_seal_number": {
                    "type": [
                      "string",
                      "null"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-243>"
                  },
                  "arrival_tolerance_minutes": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-244>"
                  },
                  "provenance": {
                    "type": "string",
                    "enum": [
                      "native",
                      "legacy-import"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-245>"
                  },
                  "version": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-246>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-229>"
              }
            },
            "x-parser-schema-id": "DockAppointmentBookedEvent"
          },
          "examples": [
            {
              "name": "outboundAppointment",
              "summary": "An OUTBOUND appointment at door D04 for the 16:00 cutoff.",
              "payload": {
                "specversion": "1.0",
                "id": "4b5c6d7e-8f9a-4b0c-1d2e-3f4a5b6c7d8e",
                "source": "/warehouse/dock-scheduling",
                "type": "com.warehouse.wms.dock-scheduling.dockappointment.DockAppointmentBooked",
                "subject": "appt-2211",
                "time": "2026-11-06T09:00:00Z",
                "datacontenttype": "application/json",
                "dataschema": "urn:warehouse:dock-scheduling:events:DockAppointmentBooked:v1",
                "data": {
                  "appointment_id": "appt-2211",
                  "site_id": "SITE-1",
                  "direction": "OUTBOUND",
                  "door_code": "D04",
                  "carrier": "STDOUT",
                  "carrier_scac": "STDOUT",
                  "cpt_id": "cpt-1600",
                  "window_start": "2026-11-06T14:00:00Z",
                  "window_end": "2026-11-06T16:00:00Z",
                  "asn_numbers": [],
                  "shipment_refs": [],
                  "expected_seal_number": null,
                  "arrival_tolerance_minutes": 30,
                  "provenance": "native",
                  "version": 1
                }
              }
            }
          ]
        }
      }
    },
    "warehouse.yard-management.events": {
      "description": "yard-management's integration topic. This service consumes ONLY\n`TrailerDocked`, `DoorWorkCompleted` and `TrailerDeparted`\n(StartOnDock, ConfirmOnDeparture and FlagDepartureWithoutClose\npolicies, ADR 0002). The three messages are validated against the\nproducer's merged AsyncAPI, pinned in `contracts/yard-management.asyncapi.yaml`\n(kept equal to its `develop` by `scripts/harness/pinned_contract_gate.py`);\n`TestConsumedYardTypesMatchTheProducersIntegrationContract` fails when a\nconsumed type is not on the producer's integration channel.\n",
      "publish": {
        "operationId": "consumeYardTrailerEvents",
        "summary": "Consume trailer dock, door-work and departure facts.",
        "description": "`TrailerDocked` at the load's door attaches the trailer (loading may\nthen start). `TrailerDeparted` for a CLOSED load confirms the\nshipment with the event's seal number and issues the BOL; for a\nLOADING load it never confirms — every package not loaded raises\n`PackageMissedLoad` and the load is left for a supervisor. `time`\nand `subject` are read from the envelope attributes, the payload via\n`DataAs`, and the consumer dedupes on `id`: a re-delivered departure\nconfirms nothing twice.\n",
        "tags": [
          {
            "name": "consumed"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "TrailerDocked",
              "title": "TrailerDocked (consumed, pinned)",
              "summary": "yard-management docked a trailer at the load's door; the trailer attaches to the load.",
              "description": "Pinned from yard-management's merged AsyncAPI\n(`contracts/`). StartOnDock\npolicy: a docking at the load's assigned door attaches the trailer,\nafter which loading may start.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-247>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-248>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/yard-management",
                    "x-parser-schema-id": "<anonymous-schema-249>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.yard-management.trailer.TrailerDocked",
                    "x-parser-schema-id": "<anonymous-schema-250>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-251>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-252>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-253>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-254>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "trailer_id",
                      "site_id",
                      "door_code",
                      "docked_at",
                      "version"
                    ],
                    "properties": {
                      "trailer_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-256>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-257>"
                      },
                      "door_code": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-258>"
                      },
                      "appointment_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-259>"
                      },
                      "asn_numbers": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-261>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-260>"
                      },
                      "visit_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-262>"
                      },
                      "docked_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-263>"
                      },
                      "version": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-264>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-255>"
                  }
                },
                "x-parser-schema-id": "TrailerDockedEvent"
              },
              "examples": [
                {
                  "name": "docked",
                  "summary": "Trailer trl-91 docks at door D04.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "5c6d7e8f-9a0b-4c1d-2e3f-4a5b6c7d8e9f",
                    "source": "/warehouse/yard-management",
                    "type": "com.warehouse.wms.yard-management.trailer.TrailerDocked",
                    "subject": "trl-91",
                    "time": "2026-11-06T14:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:yard-management:events:TrailerDocked:v1",
                    "data": {
                      "trailer_id": "trl-91",
                      "site_id": "SITE-1",
                      "door_code": "D04",
                      "appointment_id": "appt-2211",
                      "asn_numbers": [],
                      "visit_id": "visit-551",
                      "docked_at": "2026-11-06T14:00:00Z",
                      "version": 4
                    }
                  }
                }
              ]
            },
            {
              "name": "DoorWorkCompleted",
              "title": "DoorWorkCompleted (consumed, pinned)",
              "summary": "yard-management completed the door work; recorded, no state change in v1.",
              "description": "Pinned from yard-management's merged AsyncAPI. Consumed for the\nload-adherence read model (door work finish vs cutoff). A CLOSED\nload's door work completes on `LoadClosed` (wave 6.4, deferred).\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-265>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-266>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/yard-management",
                    "x-parser-schema-id": "<anonymous-schema-267>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.yard-management.trailer.DoorWorkCompleted",
                    "x-parser-schema-id": "<anonymous-schema-268>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-269>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-270>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-271>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-272>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "trailer_id",
                      "site_id",
                      "door_code",
                      "completed_at",
                      "version"
                    ],
                    "properties": {
                      "trailer_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-274>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-275>"
                      },
                      "door_code": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-276>"
                      },
                      "appointment_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-277>"
                      },
                      "completed_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-278>"
                      },
                      "load_state": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-279>"
                      },
                      "version": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-280>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-273>"
                  }
                },
                "x-parser-schema-id": "DoorWorkCompletedEvent"
              },
              "examples": [
                {
                  "name": "doorWork",
                  "summary": "Door work at D04 completes with a full trailer.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6d7e8f9a-0b1c-4d2e-3f4a-5b6c7d8e9f0a",
                    "source": "/warehouse/yard-management",
                    "type": "com.warehouse.wms.yard-management.trailer.DoorWorkCompleted",
                    "subject": "trl-91",
                    "time": "2026-11-06T15:50:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:yard-management:events:DoorWorkCompleted:v1",
                    "data": {
                      "trailer_id": "trl-91",
                      "site_id": "SITE-1",
                      "door_code": "D04",
                      "appointment_id": "appt-2211",
                      "completed_at": "2026-11-06T15:50:00Z",
                      "load_state": "FULL",
                      "version": 7
                    }
                  }
                }
              ]
            },
            {
              "name": "TrailerDeparted",
              "title": "TrailerDeparted (consumed, pinned)",
              "summary": "The trailer physically left; the seal number and departure trigger ship-confirm (ADR 0002).",
              "description": "Pinned from yard-management's merged AsyncAPI. ConfirmOnDeparture\npolicy: a departure for a CLOSED load confirms the shipment (seal\nfrom this event) and issues the BOL. FlagDepartureWithoutClose: a\ndeparture for a LOADING load NEVER confirms — every package not\nloaded raises `PackageMissedLoad` once and the load is left for a\nsupervisor. A re-delivered departure confirms nothing twice.\n",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "consumed"
                }
              ],
              "payload": {
                "type": "object",
                "required": [
                  "specversion",
                  "id",
                  "source",
                  "type",
                  "datacontenttype",
                  "data"
                ],
                "properties": {
                  "specversion": {
                    "type": "string",
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-281>"
                  },
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-282>"
                  },
                  "source": {
                    "type": "string",
                    "const": "/warehouse/yard-management",
                    "x-parser-schema-id": "<anonymous-schema-283>"
                  },
                  "type": {
                    "type": "string",
                    "const": "com.warehouse.wms.yard-management.trailer.TrailerDeparted",
                    "x-parser-schema-id": "<anonymous-schema-284>"
                  },
                  "subject": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-285>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-286>"
                  },
                  "datacontenttype": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-287>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-288>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "trailer_id",
                      "site_id",
                      "departed_at",
                      "version"
                    ],
                    "properties": {
                      "trailer_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-290>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-291>"
                      },
                      "visit_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-292>"
                      },
                      "departed_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-293>"
                      },
                      "dwell_minutes": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-294>"
                      },
                      "load_state": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-295>"
                      },
                      "seal_number": {
                        "type": "string",
                        "description": "The seal yard-management recorded; required to issue the BOL (ErrSealMissing without it).",
                        "x-parser-schema-id": "<anonymous-schema-296>"
                      },
                      "version": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-297>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-289>"
                  }
                },
                "x-parser-schema-id": "TrailerDepartedEvent"
              },
              "examples": [
                {
                  "name": "departed",
                  "summary": "Trailer trl-91 departs sealed.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "7e8f9a0b-1c2d-4e3f-4a5b-6c7d8e9f0a1b",
                    "source": "/warehouse/yard-management",
                    "type": "com.warehouse.wms.yard-management.trailer.TrailerDeparted",
                    "subject": "trl-91",
                    "time": "2026-11-06T16:01:30Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:yard-management:events:TrailerDeparted:v1",
                    "data": {
                      "trailer_id": "trl-91",
                      "site_id": "SITE-1",
                      "visit_id": "visit-551",
                      "departed_at": "2026-11-06T16:01:30Z",
                      "dwell_minutes": 121,
                      "load_state": "FULL",
                      "seal_number": "SL-4471",
                      "version": 9
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
      "LoadPlanned": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0]",
      "LoadDoorAssigned": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[1]",
      "LoadingStarted": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[2]",
      "LoadClosed": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[3]",
      "LoadReopened": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[4]",
      "LoadCancelled": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[5]",
      "ShipmentConfirmed": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[6]",
      "PackageStaged": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[7]",
      "PackageLoaded": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[8]",
      "PackageUnloaded": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[9]",
      "PackageMissedLoad": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[10]",
      "BillOfLadingIssued": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[11]",
      "BillOfLadingVoided": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[12]",
      "PackageManifested": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[0]",
      "PackageDiverted": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[1]",
      "CPTScheduleChanged": "$ref:$.channels.warehouse.process-path-management.events.publish.message",
      "ZoneRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0]",
      "LocationSlotRegistered": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1]",
      "DockAppointmentBooked": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message",
      "TrailerDocked": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[0]",
      "DoorWorkCompleted": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[1]",
      "TrailerDeparted": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[2]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "LoadPlannedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[0].payload",
      "LoadDoorAssignedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[1].payload",
      "LoadingStartedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[2].payload",
      "LoadClosedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[3].payload",
      "LoadReopenedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[4].payload",
      "LoadCancelledEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[5].payload",
      "ShipmentConfirmedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[6].payload",
      "PackageStagedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[7].payload",
      "PackageLoadedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[8].payload",
      "PackageUnloadedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[9].payload",
      "PackageMissedLoadEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[10].payload",
      "BillOfLadingIssuedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[11].payload",
      "BillOfLadingVoidedEvent": "$ref:$.channels.warehouse.outbound-shipping.events.subscribe.message.oneOf[12].payload",
      "PackageManifestedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[0].payload",
      "PackageDivertedEvent": "$ref:$.channels.warehouse.fulfillment.events.publish.message.oneOf[1].payload",
      "CPTScheduleChangedEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.payload",
      "ZoneRegisteredEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[0].payload",
      "LocationSlotRegisteredEvent": "$ref:$.channels.warehouse.facility.events.publish.message.oneOf[1].payload",
      "DockAppointmentBookedEvent": "$ref:$.channels.warehouse.dock-scheduling.events.publish.message.payload",
      "TrailerDockedEvent": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[0].payload",
      "DoorWorkCompletedEvent": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[1].payload",
      "TrailerDepartedEvent": "$ref:$.channels.warehouse.yard-management.events.publish.message.oneOf[2].payload"
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
  