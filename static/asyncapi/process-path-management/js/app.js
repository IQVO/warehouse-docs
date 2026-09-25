
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Process Path Management — Published Events",
    "version": "1.0.0",
    "description": "Publisher-side event contract for the **Process Path Management**\nbounded context. Unlike `labor-performance`'s own `apis/asyncapi.yaml`\n(which documents what that service SUBSCRIBES TO), this document\ndescribes what this service PUBLISHES: it is the SOURCE of the\nprocess-path published language for the fleet, never a consumer of\nanyone else's events.\n\n## Message format\n\nEvery message on `warehouse.process-path-management.events` uses the\nfixed, CloudEvents-*like* (but NOT strict CloudEvents-spec) envelope\nshared by every warehouse-systems publisher:\n\n```json\n{\n  \"event_id\": \"uuid-v4\",\n  \"event_type\": \"ProcessPathCreated\",\n  \"occurred_at\": \"2026-09-06T00:00:00Z\",\n  \"source\": \"process-path-management\",\n  \"data\": { ... }\n}\n```\n\n## Single, shared topic for four event types\n\nA single topic (not one per event type) matches the fleet's existing\nconvention (e.g. `warehouse.fulfillment.events` carries several event\ntypes, filtered by consumers on `event_type`). `ProcessPathCreated`,\n`ProcessPathUpdated`, and `ProcessPathDeactivated` are keyed by\n`path_id`; `CPTScheduleChanged` (ADR 0010) is keyed by `site_id` — a\ndifferent aggregate on the same topic, so a consumer replaying the\ntopic sees a given path's or a given site's events in publish order,\nnever interleaved with another aggregate's out of order.\n\n## ADR 0010: the fulfillment capability contract\n\n`ProcessPathCreated`/`ProcessPathUpdated` gained two additive fields —\n`cycle_time_p95` (the operator-declared p95 end-to-end cycle time) and\n`eligibility` (the rules a unit of work must satisfy to be routed to\nthis path) — and this topic now also carries `CPTScheduleChanged`, a\nnew event type for the site-scoped Critical Pull Time schedule. Every\nconsumer's decoder must tolerate an unknown `event_type` (ignore it,\nnot fail) and tolerate unknown/absent fields on the payloads it\nalready knows, exactly as it already must for any future addition —\nsee ADR 0010's Consequences section.\n\n## Known integration gap: no consumer wired yet\n\n`fulfillment-execution`, `wes-work-planning`, and `workforce-management`\nare this topic's intended consumers (replacing the static YAML\ncatalogue they each previously boot-loaded from\n`warehouse-infra/config/process-paths/`), but as of this document, NONE\nof them has a consumer wired to this topic yet. That is a separate,\nnot-yet-done follow-up PR in each of those three repos — see this\nservice's own `docs/docs/ecosystem/context-map.md` for the full\npicture. This service's outbound publisher itself is real and tested\n(`internal/adapters/outbound/kafka`); the gap is entirely on the\nconsumer side, in other repositories.\n",
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
  "defaultContentType": "application/json",
  "channels": {
    "warehouse.process-path-management.events": {
      "description": "This service's own topic (its `kafka.Topic` constant). Carries all three ProcessPath* event types plus CPTScheduleChanged (ADR 0010), filtered by consumers on `event_type`. Only published when EVENT_PUBLISHER=kafka; the default is a local log publisher (no Kafka required for local dev).",
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
              "contentType": "application/json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "type": "object",
                "title": "Envelope + ProcessPathCreated data",
                "required": [
                  "event_id",
                  "event_type",
                  "occurred_at",
                  "source",
                  "data"
                ],
                "properties": {
                  "event_id": {
                    "type": "string",
                    "format": "uuid",
                    "x-parser-schema-id": "<anonymous-schema-1>"
                  },
                  "event_type": {
                    "type": "string",
                    "enum": [
                      "ProcessPathCreated"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-2>"
                  },
                  "occurred_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-3>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-4>"
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
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "match_prefix": {
                        "type": "string",
                        "description": "Lower-case prefix a consumer matches a caller-supplied id against: id == match_prefix OR id starts with match_prefix + \"-\".",
                        "example": "pick",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "direct": {
                        "type": "boolean",
                        "description": "A structural fact about this path's routing shape.",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "required_capabilities": {
                        "type": "array",
                        "items": {
                          "type": "string",
                          "x-parser-schema-id": "<anonymous-schema-9>"
                        },
                        "example": [
                          "pick"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-8>"
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
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      },
                      "cycle_time_p95": {
                        "type": "string",
                        "description": "The operator-declared p95 end-to-end cycle time from release into the path to manifest (ADR 0010). Encoded as a Go duration string (e.g. \"2h0m0s\").",
                        "example": "24h0m0s",
                        "x-parser-schema-id": "<anonymous-schema-11>"
                      },
                      "eligibility": {
                        "type": "object",
                        "description": "Rules a unit of work must satisfy to be routed to this path (ADR 0010). Every field is omitted (not zero-valued) when unset; a fully permissive eligibility still appears as an empty object `{}`, never an absent field.",
                        "properties": {
                          "max_units_per_line": {
                            "type": "integer",
                            "description": "Omitted means unbounded; 1 is how a singles path is declared.",
                            "example": 1,
                            "x-parser-schema-id": "<anonymous-schema-12>"
                          },
                          "required_product_attributes": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-14>"
                            },
                            "example": [
                              "giftWrap"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-13>"
                          },
                          "excluded_product_attributes": {
                            "type": "array",
                            "items": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-16>"
                            },
                            "example": [
                              "hazmat"
                            ],
                            "x-parser-schema-id": "<anonymous-schema-15>"
                          },
                          "non_sortable": {
                            "type": "boolean",
                            "example": true,
                            "x-parser-schema-id": "<anonymous-schema-17>"
                          }
                        },
                        "x-parser-schema-id": "EligibilityData"
                      }
                    },
                    "x-parser-schema-id": "ProcessPathData"
                  }
                },
                "x-parser-schema-id": "ProcessPathCreatedEnvelope"
              },
              "examples": [
                {
                  "name": "pickPathDefined",
                  "summary": "A new PICK path defined with the pick capability.",
                  "payload": {
                    "event_id": "4f1c2a7e-9d31-4a6b-8f0e-6b2c1d5e7a90",
                    "event_type": "ProcessPathCreated",
                    "occurred_at": "2026-09-06T00:00:00Z",
                    "source": "process-path-management",
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
                    "event_id": "6a2d3b8f-0e42-4b7c-9f1d-7c3e2f6b8a91",
                    "event_type": "ProcessPathCreated",
                    "occurred_at": "2026-09-13T00:00:00Z",
                    "source": "process-path-management",
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
                    "event_id": "9c4e5f21-7a83-4d5f-b1c2-8e5a3f7d2b64",
                    "event_type": "ProcessPathCreated",
                    "occurred_at": "2026-09-13T00:00:00Z",
                    "source": "process-path-management",
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
              "contentType": "application/json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "type": "object",
                "title": "Envelope + ProcessPathUpdated data",
                "required": [
                  "event_id",
                  "event_type",
                  "occurred_at",
                  "source",
                  "data"
                ],
                "properties": {
                  "event_id": {
                    "type": "string",
                    "format": "uuid",
                    "x-parser-schema-id": "<anonymous-schema-18>"
                  },
                  "event_type": {
                    "type": "string",
                    "enum": [
                      "ProcessPathUpdated"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-19>"
                  },
                  "occurred_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-20>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-21>"
                  },
                  "data": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.properties.data"
                },
                "x-parser-schema-id": "ProcessPathUpdatedEnvelope"
              },
              "examples": [
                {
                  "name": "pickPathRevisedWithHazmat",
                  "summary": "The PICK path's zone and required capabilities were revised.",
                  "payload": {
                    "event_id": "8a3d6c11-52b7-4f0d-9c14-3e7a5b8d2f46",
                    "event_type": "ProcessPathUpdated",
                    "occurred_at": "2026-09-06T01:00:00Z",
                    "source": "process-path-management",
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
              "contentType": "application/json",
              "tags": [
                {
                  "name": "process-path"
                }
              ],
              "payload": {
                "type": "object",
                "title": "Envelope + ProcessPathDeactivated data",
                "required": [
                  "event_id",
                  "event_type",
                  "occurred_at",
                  "source",
                  "data"
                ],
                "properties": {
                  "event_id": {
                    "type": "string",
                    "format": "uuid",
                    "x-parser-schema-id": "<anonymous-schema-22>"
                  },
                  "event_type": {
                    "type": "string",
                    "enum": [
                      "ProcessPathDeactivated"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-23>"
                  },
                  "occurred_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-24>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-25>"
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
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-26>"
                  }
                },
                "x-parser-schema-id": "ProcessPathDeactivatedEnvelope"
              },
              "examples": [
                {
                  "name": "packPathDeactivated",
                  "summary": "The PACK path was retired.",
                  "payload": {
                    "event_id": "c25b9f83-7e64-4a19-b8d2-0f5a3c6e1b47",
                    "event_type": "ProcessPathDeactivated",
                    "occurred_at": "2026-09-06T02:00:00Z",
                    "source": "process-path-management",
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
              "contentType": "application/json",
              "tags": [
                {
                  "name": "cpt-schedule"
                }
              ],
              "payload": {
                "type": "object",
                "title": "Envelope + CPTScheduleChanged data",
                "required": [
                  "event_id",
                  "event_type",
                  "occurred_at",
                  "source",
                  "data"
                ],
                "properties": {
                  "event_id": {
                    "type": "string",
                    "format": "uuid",
                    "x-parser-schema-id": "<anonymous-schema-28>"
                  },
                  "event_type": {
                    "type": "string",
                    "enum": [
                      "CPTScheduleChanged"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-29>"
                  },
                  "occurred_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-30>"
                  },
                  "source": {
                    "type": "string",
                    "enum": [
                      "process-path-management"
                    ],
                    "x-parser-schema-id": "<anonymous-schema-31>"
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
                        "x-parser-schema-id": "<anonymous-schema-32>"
                      },
                      "timezone": {
                        "type": "string",
                        "description": "IANA zone, e.g. America/Sao_Paulo.",
                        "example": "America/Sao_Paulo",
                        "x-parser-schema-id": "<anonymous-schema-33>"
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
                              "x-parser-schema-id": "<anonymous-schema-35>"
                            },
                            "local_time": {
                              "type": "string",
                              "description": "Recurring daily cutoff, \"HH:MM\" 24-hour form.",
                              "example": "15:00",
                              "x-parser-schema-id": "<anonymous-schema-36>"
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
                                "x-parser-schema-id": "<anonymous-schema-38>"
                              },
                              "example": [
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri"
                              ],
                              "x-parser-schema-id": "<anonymous-schema-37>"
                            },
                            "ship_method": {
                              "type": "string",
                              "description": "Free-form label (\"ground\", \"same-day\"); no carrier integration exists in this fleet.",
                              "example": "ground",
                              "x-parser-schema-id": "<anonymous-schema-39>"
                            },
                            "eligible_path_ids": {
                              "type": "array",
                              "items": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-41>"
                              },
                              "description": "The path families that can make this cutoff. Consumers compute the next concrete occurrence of a cutoff themselves from (local_time, days_of_week, timezone) — this service never publishes absolute timestamps for a recurring rule.",
                              "example": [
                                "PICK",
                                "PACK"
                              ],
                              "x-parser-schema-id": "<anonymous-schema-40>"
                            }
                          },
                          "x-parser-schema-id": "CutoffData"
                        },
                        "x-parser-schema-id": "<anonymous-schema-34>"
                      }
                    },
                    "x-parser-schema-id": "CPTScheduleData"
                  }
                },
                "x-parser-schema-id": "CPTScheduleChangedEnvelope"
              },
              "examples": [
                {
                  "name": "sp1ScheduleDefined",
                  "summary": "Site sp1's schedule defined with one 15:00 ground cutoff.",
                  "payload": {
                    "event_id": "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
                    "event_type": "CPTScheduleChanged",
                    "occurred_at": "2026-09-13T00:00:00Z",
                    "source": "process-path-management",
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
    }
  },
  "components": {
    "messages": {
      "ProcessPathCreated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0]",
      "ProcessPathUpdated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1]",
      "ProcessPathDeactivated": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2]",
      "CPTScheduleChanged": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3]"
    },
    "schemas": {
      "ProcessPathCreatedEnvelope": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload",
      "ProcessPathUpdatedEnvelope": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[1].payload",
      "ProcessPathDeactivatedEnvelope": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[2].payload",
      "CPTScheduleChangedEnvelope": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload",
      "ProcessPathData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.properties.data",
      "EligibilityData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[0].payload.properties.data.properties.eligibility",
      "CPTScheduleData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload.properties.data",
      "CutoffData": "$ref:$.channels.warehouse.process-path-management.events.publish.message.oneOf[3].payload.properties.data.properties.cutoffs.items"
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
  