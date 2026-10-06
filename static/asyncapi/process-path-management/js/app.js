
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Process Path Management — Published Events",
    "version": "1.0.0",
    "description": "Publisher-side event contract for the **Process Path Management**\nbounded context. Unlike `labor-performance`'s own `apis/asyncapi.yaml`\n(which documents what that service SUBSCRIBES TO), this document\ndescribes what this service PUBLISHES: it is the SOURCE of the\nprocess-path published language for the fleet, never a consumer of\nanyone else's events.\n\n## Message format: CloudEvents 1.0 (mandatory, ADR 0016)\n\nEvery message on `warehouse.process-path-management.events` AND\n`warehouse.process-path-management.analytics` is a CloudEvents 1.0\nevent in structured content mode (Kafka protocol binding). The Kafka\nmessage value is the JSON event format and every message carries the\nKafka header `content-type: application/cloudevents+json; charset=UTF-8`.\nW3C trace context stays in the `traceparent`/`tracestate` headers.\nThere is no other envelope, no dual-write and no envelope toggle.\n\n```json\n{\n  \"specversion\": \"1.0\",\n  \"id\": \"4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90\",\n  \"source\": \"/warehouse/process-path-management\",\n  \"type\": \"com.warehouse.wes.process-path-management.processpath.ProcessPathCreated\",\n  \"subject\": \"PICK\",\n  \"time\": \"2026-09-06T00:00:00Z\",\n  \"datacontenttype\": \"application/json\",\n  \"dataschema\": \"urn:warehouse:process-path-management:events:ProcessPathCreated:v1\",\n  \"data\": { \"path_id\": \"PICK\", \"...\": \"...\" }\n}\n```\n\n- `id` is minted once per domain event and persisted with the outbox\n  row, so a redelivery carries the same `id`; `(source, id)` is the\n  consumer idempotency key.\n- `subject` is the aggregate id (`path_id` for ProcessPath* events,\n  `site_id` for CPTScheduleChanged) — the same value as the Kafka key.\n- `type` = `com.warehouse.wes.process-path-management.<entity>.<EventName>`.\n  These exact strings are a cross-service contract (consumed by\n  fulfillment-execution, wes-work-planning, workforce-management and\n  order-management); consumers dispatch on the FULL `type`.\n- `dataschema` = `urn:warehouse:process-path-management:<events|analytics>:<EventName>:v1`\n  distinguishes the integration payload from the analytics payload of\n  the same occurrence (today both carry the identical `data` shape).\n- A breaking payload change ships as a new `.v2` type with a new\n  dataschema version, never by mutating an existing one.\n\n## Single, shared topic for four event types\n\nA single topic (not one per event type) per stream. Consumers dispatch\non the CloudEvents `type`. `ProcessPathCreated`, `ProcessPathUpdated`,\nand `ProcessPathDeactivated` are keyed by `path_id`;\n`CPTScheduleChanged` (ADR 0010) is keyed by `site_id` — a different\naggregate on the same topic, so a consumer replaying the topic sees a\ngiven path's or a given site's events in publish order, never\ninterleaved with another aggregate's out of order.\n\n## ADR 0010: the fulfillment capability contract\n\n`ProcessPathCreated`/`ProcessPathUpdated` gained two additive fields —\n`cycle_time_p95` (the operator-declared p95 end-to-end cycle time) and\n`eligibility` (the rules a unit of work must satisfy to be routed to\nthis path) — and this topic now also carries `CPTScheduleChanged`, a\nnew event type for the site-scoped Critical Pull Time schedule. Every\nconsumer's decoder must tolerate an unknown `type` (ignore it,\nnot fail) and tolerate unknown/absent fields on the payloads it\nalready knows, exactly as it already must for any future addition —\nsee ADR 0010's Consequences section.\n\n## Consumers\n\n`fulfillment-execution`, `wes-work-planning`, `workforce-management`\n(ProcessPath* catalogue caches) and `order-management` (ProcessPath*\nand CPTScheduleChanged) consume the integration topic. The analytics\ntopic is consumed only by this service's own projector\n(`cmd/pathmgmt-projector`). See `docs/docs/ecosystem/context-map.md`.\n",
    "contact": {
      "name": "Process Path Management Team",
      "url": "https://github.com/claudioed/process-path-management",
      "email": "process-path-management@warehouse-systems.internal"
    },
    "license": {
      "name": "MIT"
    }
  },
  "tags": [
    {
      "name": "process-path-management",
      "description": "The Process Path Management bounded context (Generic Subdomain)."
    },
    {
      "name": "process-path",
      "description": "Events describing the ProcessPath aggregate lifecycle."
    },
    {
      "name": "cpt-schedule",
      "description": "Events describing the site-scoped CPTSchedule aggregate (ADR 0010)."
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Shared Kafka broker for warehouse-systems integration events. Locally, a broker is available at localhost:9092 via ~/warehouse-systems/docker-compose.kafka.yml."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.process-path-management.events": {
      "description": "This service's own integration topic (its `kafka.Topic` constant). Carries all three ProcessPath* event types plus CPTScheduleChanged (ADR 0010) as CloudEvents 1.0 (ADR 0016), dispatched by consumers on the full `type`. Only published when EVENT_PUBLISHER=kafka; the default is a local log publisher (no Kafka required for local dev).",
      "publish": {
        "operationId": "publishProcessPathEvents",
        "summary": "Publish ProcessPathCreated / ProcessPathUpdated / ProcessPathDeactivated / CPTScheduleChanged.",
        "description": "One message per domain event raised by the DefinePath, RevisePath, DeactivatePath, and DefineCPTSchedule use cases. A no-op revision (RevisePath or DefineCPTSchedule with no actual change) and a no-op deactivation (already-deactivated path) raise nothing — consumers never have to diff two identical payloads to notice nothing changed.",
        "tags": [
          {
            "name": "process-path"
          },
          {
            "name": "cpt-schedule"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "Process Path Created",
              "summary": "A brand-new process path was defined.",
              "description": "Raised the first time a PathId is defined. Carries enough of the definition for a consumer to build its local read model without a follow-up query.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathCreated data (events stream)",
                "allOf": [
                  {
                    "type": "object",
                    "title": "CloudEvents 1.0 envelope (structured mode, ADR 0016)",
                    "description": "Every attribute is REQUIRED in this fleet. Kafka header `content-type: application/cloudevents+json; charset=UTF-8`.",
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
                        "description": "Minted once per domain event, persisted with the outbox row; stable across redelivery. Consumer dedupe key.",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "source": {
                        "type": "string",
                        "const": "/warehouse/process-path-management",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "type": {
                        "type": "string",
                        "description": "com.warehouse.wes.process-path-management.<entity>.<EventName>",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "subject": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Aggregate id (path_id or site_id) — equal to the Kafka key.",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The domain event's occurred-at instant, UTC.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "data": {
                        "type": "object",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      }
                    },
                    "x-parser-schema-id": "CloudEventEnvelope"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "description": "The canonical identity of the path.",
                            "example": "PICK",
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "match_prefix": {
                            "type": "string",
                            "description": "Lower-case prefix a consumer matches a caller-supplied id against: id == match_prefix OR id starts with match_prefix + \"-\".",
                            "example": "pick",
                            "x-parser-schema-id": "<anonymous-schema-14>"
                          },
                          "direct": {
                            "type": "boolean",
                            "description": "A structural fact about this path's routing shape.",
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "required_capabilities": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-17>"
                            },
                            "example": [
                              "pick"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-16>"
                          },
                          "destination_location_role": {
                            "type": "string",
                            "description": "Optional declaration of what kind of facility-layout LocationRole this path's completed work is destined for (ADR 0006). Omitted entirely (not empty-stringed) when no destination role was declared for this path — the default, most common case.",
                            "enum": [
                              "Drop",
                              "WorkCenter",
                              "Shipping"
                            ],
                            "example": "Drop",
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          },
                          "cycle_time_p95": {
                            "type": "string",
                            "description": "The operator-declared p95 end-to-end cycle time from release into the path to manifest (ADR 0010). Encoded as a Go duration string (e.g. \"2h0m0s\").",
                            "example": "24h0m0s",
                            "x-parser-schema-id": "<anonymous-schema-19>"
                          },
                          "eligibility": {
                            "type": "object",
                            "description": "Rules a unit of work must satisfy to be routed to this path (ADR 0010). Every field is omitted (not zero-valued) when unset; a fully permissive eligibility still appears as an empty object `{}`, never an absent field.",
                            "properties": {
                              "max_units_per_line": {
                                "type": "integer",
                                "description": "Omitted means unbounded; 1 is how a singles path is declared.",
                                "example": 1,
                                "x-parser-schema-id": "<anonymous-schema-20>"
                              },
                              "required_product_attributes": {
                                "type": "array",
                                "items": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-22>"
                                },
                                "example": [
                                  "giftWrap"
                                ],
                                "x-parser-schema-id": "<anonymous-schema-21>"
                              },
                              "excluded_product_attributes": {
                                "type": "array",
                                "items": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-24>"
                                },
                                "example": [
                                  "hazmat"
                                ],
                                "x-parser-schema-id": "<anonymous-schema-23>"
                              },
                              "non_sortable": {
                                "type": "boolean",
                                "example": true,
                                "x-parser-schema-id": "<anonymous-schema-25>"
                              }
                            },
                            "x-parser-schema-id": "EligibilityData"
                          }
                        },
                        "x-parser-schema-id": "ProcessPathData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-10>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathCreatedCloudEvent"
              },
              "examples": [
                {
                  "name": "pickPathDefined",
                  "summary": "A new PICK path defined with the pick capability.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "PICK",
                    "time": "2026-09-06T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [
                        "pick"
                      ],
                      "cycle_time_p95": "24h0m0s"
                    }
                  }
                },
                {
                  "name": "packPathDefinedWithDestinationLocationRole",
                  "summary": "A new PACK path defined with a declared Drop destination role.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "6a2d3b8f-0e42-4b7c-9f1d-7c3e2f6b8a91",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "PACK",
                    "time": "2026-09-13T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "PACK",
                      "match_prefix": "pack",
                      "direct": true,
                      "required_capabilities": [
                        "pack"
                      ],
                      "destination_location_role": "Drop",
                      "cycle_time_p95": "6h0m0s"
                    }
                  }
                },
                {
                  "name": "singlesPathDefinedWithEligibility",
                  "summary": "A new SINGLES path with a narrowed eligibility (ADR 0010): at most one unit per line, gift-wrap required, hazmat excluded, non-sortable.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "9c4e5f21-7a83-4d5f-b1c2-8e5a3f7d2b64",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "SINGLES",
                    "time": "2026-09-13T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "SINGLES",
                      "match_prefix": "singles",
                      "direct": true,
                      "required_capabilities": [
                        "pick"
                      ],
                      "cycle_time_p95": "1h30m0s",
                      "eligibility": {
                        "max_units_per_line": 1,
                        "required_product_attributes": [
                          "giftWrap"
                        ],
                        "excluded_product_attributes": [
                          "hazmat"
                        ],
                        "non_sortable": true
                      }
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathUpdated",
              "title": "Process Path Updated",
              "summary": "An Active path's matchPrefix, requiredCapabilities, cycleTimeP95, or eligibility was revised.",
              "description": "Raised when RevisePath actually changes something. Not raised for a no-op update.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathUpdated data (events stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-26>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathUpdatedCloudEvent"
              },
              "examples": [
                {
                  "name": "pickPathRevisedWithHazmat",
                  "summary": "The PICK path's zone and required capabilities were revised.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "subject": "PICK",
                    "time": "2026-09-06T01:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathUpdated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick-zone-a",
                      "direct": true,
                      "required_capabilities": [
                        "pick",
                        "hazmat"
                      ],
                      "cycle_time_p95": "24h0m0s"
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "Process Path Deactivated",
              "summary": "A path was retired.",
              "description": "Raised the first time a path transitions to Deactivated (never republished on a subsequent, already-deactivated deactivation attempt). Consumers must stop accepting NEW work against this path once they observe this event, but this service takes no position on in-flight work already assigned to it in a downstream context — that is each consumer's own operational concern.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathDeactivated data (events stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                        "x-parser-schema-id": "<anonymous-schema-30>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                        "x-parser-schema-id": "<anonymous-schema-31>"
                      },
                      "data": {
                        "type": "object",
                        "required": [
                          "path_id"
                        ],
                        "properties": {
                          "path_id": {
                            "type": "string",
                            "example": "PACK",
                            "description": "required_capabilities/match_prefix/direct/cycle_time_p95/ eligibility are omitted (not empty-arrayed/zeroed) on a deactivation — it carries no definition data, only the PathId and the fact that it happened.",
                            "x-parser-schema-id": "<anonymous-schema-32>"
                          }
                        },
                        "x-parser-schema-id": "ProcessPathDeactivatedData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-29>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathDeactivatedCloudEvent"
              },
              "examples": [
                {
                  "name": "packPathDeactivated",
                  "summary": "The PACK path was retired.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "c25b9f83-7e64-4a19-b8d2-0f5a3c6e1b47",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "subject": "PACK",
                    "time": "2026-09-06T02:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:ProcessPathDeactivated:v1",
                    "data": {
                      "path_id": "PACK"
                    }
                  }
                }
              ]
            },
            {
              "name": "CPTScheduleChanged",
              "title": "CPT Schedule Changed",
              "summary": "A site's Critical Pull Time (CPT) schedule was defined or revised.",
              "description": "Raised by DefineCPTSchedule whenever a schedule is first defined or a subsequent revision actually changes something (ADR 0010). Carries the FULL schedule — a snapshot, not a diff — so a fresh consumer replaying from FirstOffset needs no prior state to build its read model, the same self-sufficient-event convention ProcessPathCreated/Updated already use. Keyed by `site_id`, not `path_id` — a different aggregate sharing this topic.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "cpt-schedule"
                }
              ],
              "payload": {
                "title": "CloudEvent + CPTScheduleChanged data (events stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                        "x-parser-schema-id": "<anonymous-schema-34>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:events:CPTScheduleChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-35>"
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
                            "description": "The fulfillment site this schedule belongs to. Uses facility-layout's site identifier vocabulary but is not validated against it (this service has zero inbound dependency, ADR 0001).",
                            "example": "sp1",
                            "x-parser-schema-id": "<anonymous-schema-36>"
                          },
                          "timezone": {
                            "type": "string",
                            "description": "IANA zone, e.g. America/Sao_Paulo.",
                            "example": "America/Sao_Paulo",
                            "x-parser-schema-id": "<anonymous-schema-37>"
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
                                  "description": "Stable id, unique within the site.",
                                  "example": "sp1-1500",
                                  "x-parser-schema-id": "<anonymous-schema-39>"
                                },
                                "local_time": {
                                  "type": "string",
                                  "description": "Recurring daily cutoff, \"HH:MM\" 24-hour form.",
                                  "example": "15:00",
                                  "x-parser-schema-id": "<anonymous-schema-40>"
                                },
                                "days_of_week": {
                                  "type": "array",
                                  "items": {
                                    "type": "string",
                                    "enum": [
                                      "Mon",
                                      "Tue",
                                      "Wed",
                                      "Thu",
                                      "Fri",
                                      "Sat",
                                      "Sun"
                                    ],
                                    "x-parser-schema-id": "<anonymous-schema-42>"
                                  },
                                  "example": [
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-41>"
                                },
                                "ship_method": {
                                  "type": "string",
                                  "description": "Free-form label (\"ground\", \"same-day\"); no carrier integration exists in this fleet.",
                                  "example": "ground",
                                  "x-parser-schema-id": "<anonymous-schema-43>"
                                },
                                "eligible_path_ids": {
                                  "type": "array",
                                  "items": {
                                    "type": "string",
                                    "x-parser-schema-id": "<anonymous-schema-45>"
                                  },
                                  "description": "The path families that can make this cutoff. Consumers compute the next concrete occurrence of a cutoff themselves from (local_time, days_of_week, timezone) — this service never publishes absolute timestamps for a recurring rule.",
                                  "example": [
                                    "PICK",
                                    "PACK"
                                  ],
                                  "x-parser-schema-id": "<anonymous-schema-44>"
                                }
                              },
                              "x-parser-schema-id": "CutoffData"
                            },
                            "x-parser-schema-id": "<anonymous-schema-38>"
                          }
                        },
                        "x-parser-schema-id": "CPTScheduleData"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  }
                ],
                "x-parser-schema-id": "CPTScheduleChangedCloudEvent"
              },
              "examples": [
                {
                  "name": "sp1ScheduleDefined",
                  "summary": "Site sp1's schedule defined with one 15:00 ground cutoff.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                    "subject": "sp1",
                    "time": "2026-09-13T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:events:CPTScheduleChanged:v1",
                    "data": {
                      "site_id": "sp1",
                      "timezone": "America/Sao_Paulo",
                      "cutoffs": [
                        {
                          "cpt_id": "sp1-1500",
                          "local_time": "15:00",
                          "days_of_week": [
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri"
                          ],
                          "ship_method": "ground",
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
          ]
        }
      }
    },
    "warehouse.process-path-management.analytics": {
      "description": "Internal analytics topic (`kafka.AnalyticsTopic`, ADR 0007), consumed only by this service's own projector. Same CloudEvents `type`, `subject`, `time` and `data` as the integration occurrence; only `dataschema` differs (`...:analytics:<EventName>:v1`). Messages that fail CloudEvents validation are dead-lettered to `warehouse.process-path-management.analytics.dlq`.",
      "publish": {
        "operationId": "publishProcessPathAnalyticsEvents",
        "summary": "Publish the analytics occurrence of every domain event.",
        "description": "Written in the same outbox transaction as the integration row, sharing its CloudEvents `id`.",
        "tags": [
          {
            "name": "process-path"
          },
          {
            "name": "cpt-schedule"
          }
        ],
        "message": {
          "oneOf": [
            {
              "name": "ProcessPathCreated",
              "title": "ProcessPathCreated (analytics stream)",
              "summary": "Analytics occurrence of ProcessPathCreated for this service's own projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathCreated data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                        "x-parser-schema-id": "<anonymous-schema-47>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:analytics:ProcessPathCreated:v1",
                        "x-parser-schema-id": "<anonymous-schema-48>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-46>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathCreatedAnalyticsCloudEvent"
              },
              "examples": [
                {
                  "name": "processPathCreatedAnalytics",
                  "summary": "Same occurrence as the integration message; only dataschema differs.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathCreated",
                    "subject": "PICK",
                    "time": "2026-09-06T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:analytics:ProcessPathCreated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick",
                      "direct": true,
                      "required_capabilities": [
                        "pick"
                      ],
                      "cycle_time_p95": "24h0m0s",
                      "eligibility": {}
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathUpdated",
              "title": "ProcessPathUpdated (analytics stream)",
              "summary": "Analytics occurrence of ProcessPathUpdated for this service's own projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathUpdated data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:analytics:ProcessPathUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-49>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathUpdatedAnalyticsCloudEvent"
              },
              "examples": [
                {
                  "name": "processPathUpdatedAnalytics",
                  "summary": "Same occurrence as the integration message; only dataschema differs.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathUpdated",
                    "subject": "PICK",
                    "time": "2026-09-06T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:analytics:ProcessPathUpdated:v1",
                    "data": {
                      "path_id": "PICK",
                      "match_prefix": "pick-zone-a",
                      "direct": true,
                      "required_capabilities": [
                        "pick",
                        "hazmat"
                      ],
                      "cycle_time_p95": "24h0m0s",
                      "eligibility": {}
                    }
                  }
                }
              ]
            },
            {
              "name": "ProcessPathDeactivated",
              "title": "ProcessPathDeactivated (analytics stream)",
              "summary": "Analytics occurrence of ProcessPathDeactivated for this service's own projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "title": "CloudEvent + ProcessPathDeactivated data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                        "x-parser-schema-id": "<anonymous-schema-53>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:analytics:ProcessPathDeactivated:v1",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-52>"
                  }
                ],
                "x-parser-schema-id": "ProcessPathDeactivatedAnalyticsCloudEvent"
              },
              "examples": [
                {
                  "name": "processPathDeactivatedAnalytics",
                  "summary": "Same occurrence as the integration message; only dataschema differs.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.processpath.ProcessPathDeactivated",
                    "subject": "PACK",
                    "time": "2026-09-06T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:analytics:ProcessPathDeactivated:v1",
                    "data": {
                      "path_id": "PACK"
                    }
                  }
                }
              ]
            },
            {
              "name": "CPTScheduleChanged",
              "title": "CPTScheduleChanged (analytics stream)",
              "summary": "Analytics occurrence of CPTScheduleChanged for this service's own projector.",
              "contentType": "application/cloudevents+json",
              "tags": [
                {
                  "name": "cpt-schedule"
                }
              ],
              "payload": {
                "title": "CloudEvent + CPTScheduleChanged data (analytics stream)",
                "allOf": [
                  "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                        "x-parser-schema-id": "<anonymous-schema-56>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:process-path-management:analytics:CPTScheduleChanged:v1",
                        "x-parser-schema-id": "<anonymous-schema-57>"
                      },
                      "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload.allOf[1].properties.data"
                    },
                    "x-parser-schema-id": "<anonymous-schema-55>"
                  }
                ],
                "x-parser-schema-id": "CPTScheduleChangedAnalyticsCloudEvent"
              },
              "examples": [
                {
                  "name": "cPTScheduleChangedAnalytics",
                  "summary": "Same occurrence as the integration message; only dataschema differs.",
                  "payload": {
                    "specversion": "1.0",
                    "id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "source": "/warehouse/process-path-management",
                    "type": "com.warehouse.wes.process-path-management.cptschedule.CPTScheduleChanged",
                    "subject": "sp1",
                    "time": "2026-09-06T00:00:00Z",
                    "datacontenttype": "application/json",
                    "dataschema": "urn:warehouse:process-path-management:analytics:CPTScheduleChanged:v1",
                    "data": {
                      "site_id": "sp1",
                      "timezone": "America/Sao_Paulo",
                      "cutoffs": [
                        {
                          "cpt_id": "sp1-1500",
                          "local_time": "15:00",
                          "days_of_week": [
                            "Mon"
                          ],
                          "ship_method": "ground",
                          "eligible_path_ids": [
                            "PICK"
                          ]
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
    }
  },
  "components": {
    "messages": {
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2]",
      "CPTScheduleChanged": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3]",
      "ProcessPathCreatedAnalytics": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[0]",
      "ProcessPathUpdatedAnalytics": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[1]",
      "ProcessPathDeactivatedAnalytics": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[2]",
      "CPTScheduleChangedAnalytics": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[3]"
    },
    "schemas": {
      "CloudEventEnvelope": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[0]",
      "ProcessPathCreatedCloudEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload",
      "ProcessPathUpdatedCloudEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1].payload",
      "ProcessPathDeactivatedCloudEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2].payload",
      "CPTScheduleChangedCloudEvent": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload",
      "ProcessPathCreatedAnalyticsCloudEvent": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[0].payload",
      "ProcessPathUpdatedAnalyticsCloudEvent": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[1].payload",
      "ProcessPathDeactivatedAnalyticsCloudEvent": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[2].payload",
      "CPTScheduleChangedAnalyticsCloudEvent": "$ref:$.channels.warehouse.process-path-management.analytics.publish.message.oneOf[3].payload",
      "ProcessPathDeactivatedData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2].payload.allOf[1].properties.data",
      "ProcessPathData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data",
      "EligibilityData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.allOf[1].properties.data.properties.eligibility",
      "CPTScheduleData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload.allOf[1].properties.data",
      "CutoffData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload.allOf[1].properties.data.properties.cutoffs.items"
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
  