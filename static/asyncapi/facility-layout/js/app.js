
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Facility Layout Domain Events",
    "version": "1.0.0",
    "description": "Domain-event catalog for the **facility-layout** bounded context, the system of record for where things physically are in the building: the site's structural hierarchy (Site, Area, Zone, Aisle) and the coded storage slots inside it. This context is a Generic Subdomain and an **Open Host Service** — these events ARE its Published Language, and every downstream service is a Conformist to them. Unlike a service that forwards a curated subset, this context's Kafka publisher (`internal/adapters/outbound/kafka/publisher.go`) emits **every** domain event to the integration topic — the whole Published Language.\n\n**Envelope: CloudEvents 1.0 (mandatory, ADR-0024).** Every message on this channel is a CloudEvents 1.0 event in **structured content mode** (CloudEvents Kafka protocol binding): the Kafka message value is the JSON event format and every message carries the Kafka header `content-type: application/cloudevents+json; charset=UTF-8`. All of `specversion` (`1.0`), `id` (UUID, minted once per domain event and stable across outbox redelivery), `source` (`/warehouse/facility-layout`), `type`, `subject` (the aggregate instance id), `time` (the domain occurred-at, UTC), `datacontenttype` (`application/json`) and `dataschema` (`urn:warehouse:facility-layout:events:<EventName>:v1`) are required. `data` carries the domain event's own JSON verbatim — note it also carries `eventName`, `eventType` and `occurredAt` fields, because the domain event's struct tags are the wire shape. There is no other envelope: consumers must reject (DLQ/skip) anything that fails CloudEvents validation.\n\n**The `type` attribute** follows the platform-wide reverse-DNS convention `com.warehouse.<subdomain>.<bounded-context>.<entity>.<EventName>` — all lowercase except the final PascalCase event name, and the entity segment carries no hyphen even for multi-word aggregate names. This service's subdomain segment is `wms`: bin-accurate location is WMS-tier in the domain reference. Consumers dispatch on the FULL `type` string. Example: `com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered`. A breaking payload change is published as a new `.v2` type with a `:v2` dataschema, never by mutating an existing one.\n\n**Partitioning and ordering.** The Kafka message key is the identity of the aggregate that raised the event (site code, zone id, aisle id, location code, rule id, location type name), so all events for one aggregate land on the same partition and per-aggregate order is preserved. `FacilityLayoutImported` and the four ADR-0017 geometry / travel-graph events key on their event type (the publisher's `aggregateKey` fallback, unchanged by ADR-0024); their CloudEvents `subject` still names the aggregate instance.\n\n**Live consumer.** `inventory-storage` maintains a local read model of location classifications fed by this topic (`internal/adapters/outbound/facilitycache/`, selected with `LOCATION_LOOKUP_MODE=kafka`), replacing its per-stow synchronous `GET /locations/{locationCode}/classification` call. It consumes **ZoneRegistered**, **LocationSlotRegistered** and **LocationSlotDecommissioned**, replaying the topic from the first offset on every process start under a per-instance-unique consumer group, and gates its readiness on that replay completing. The remaining five messages are published but have no wired consumer today — they are Published Language available for future Conformists, stated so a downstream team cannot mistake an available event for a consumed one. See facility-layout ADR-0009 (integration publishing) and inventory-storage ADR-0013 (the location-classification cache).\n",
    "contact": {
      "name": "Warehouse Systems Platform Team",
      "url": "https://github.com/claudioed/facility-layout",
      "email": "claudioed.oliveira@gmail.com"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  "tags": [
    {
      "name": "facility-layout",
      "description": "The facility-layout bounded context (wms subdomain) — the authoritative record of the warehouse's physical structure: sites, zones, aisles and coded location slots.\n"
    },
    {
      "name": "site",
      "description": "Events raised by the Site aggregate: a physical facility/building added to the warehouse map.\n"
    },
    {
      "name": "zone",
      "description": "Events raised by the Zone aggregate: a behavioral region inside a site's area, carrying temperature class and hazmat attributes.\n"
    },
    {
      "name": "aisle",
      "description": "Events raised by the Aisle aggregate: a physical corridor inside a zone, with walk-sequence and traversal direction.\n"
    },
    {
      "name": "locationtype",
      "description": "Events raised by the LocationType aggregate: a reusable slot shape/kind with weight and volume capacity.\n"
    },
    {
      "name": "placementrule",
      "description": "Events raised by the PlacementRule aggregate: a rule constraining which LocationTypes are legal in which Zones.\n"
    },
    {
      "name": "locationslot",
      "description": "Events raised by the LocationSlot aggregate: the coded leaf slots of the warehouse map — registration, decommissioning, and bulk import.\n"
    },
    {
      "name": "structure",
      "description": "Events raised by the FixedStructure aggregate (ADR-0017): site-scoped physical obstacles — walls, columns, offices, conveyors — drawn on the warehouse map. Not a location; nothing can be stowed at one.\n"
    },
    {
      "name": "crossaisle",
      "description": "Events raised by the CrossAisle aggregate (ADR-0017): zone-scoped connections between two aisles at a bay ordinal, the travel graph's cross-aisle edges.\n"
    }
  ],
  "servers": {
    "production": {
      "url": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "The shared warehouse-systems Kafka broker (the in-cluster release, reachable from the host at `localhost:9092`), addressed via the `KAFKA_BROKERS` environment variable. The Kafka publisher is selected with `EVENT_PUBLISHER=kafka`; the default (unset) keeps the Postgres outbox / log publisher, so tests and local runs never need a broker.\n"
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.facility.events": {
      "description": "The single outbound integration topic for this bounded context, named after the `Topic` constant in `internal/adapters/outbound/kafka/publisher.go` (`warehouse.facility.events`). Every domain event this context raises is published here when `EVENT_PUBLISHER=kafka` — the whole Published Language, not a subset. The one live consumer today is inventory-storage's location-classification cache (ZoneRegistered, LocationSlotRegistered, LocationSlotDecommissioned); everything else is available, unconsumed Published Language.\n",
      "subscribe": {
        "operationId": "onFacilityEvent",
        "summary": "Consume facility-layout's Published Language.",
        "description": "Subscribe to every structural fact about the warehouse map. At-least- once delivery is the consumer's problem: deduplicate on the CloudEvents `id`, and expect to see the full history on a from-first-offset replay. A consumer building a local read model should follow the inventory-storage precedent: per-process-unique consumer group, FirstOffset replay, readiness gated on catching up to the high watermark observed at start.\n",
        "message": {
          "oneOf": [
            {
              "name": "SiteRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Site registered",
              "tags": [
                {
                  "name": "site"
                }
              ],
              "summary": "A physical facility/building was added to the warehouse map.",
              "description": "Raised by `RegisterSite`. Kafka key: `siteCode`. No consumer wired today.\n",
              "payload": {
                "allOf": [
                  {
                    "type": "object",
                    "description": "CloudEvents 1.0 structured-mode envelope (ADR-0024). Every attribute below is REQUIRED in this fleet. `data` carries the domain event's own JSON verbatim.\n",
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
                    "additionalProperties": false,
                    "properties": {
                      "specversion": {
                        "type": "string",
                        "const": "1.0",
                        "x-parser-schema-id": "<anonymous-schema-2>"
                      },
                      "id": {
                        "type": "string",
                        "format": "uuid",
                        "description": "Minted once per domain event and persisted with the outbox row, so a redelivery carries the same id. `(source, id)` is the consumer idempotency key.\n",
                        "x-parser-schema-id": "<anonymous-schema-3>"
                      },
                      "source": {
                        "type": "string",
                        "format": "uri-reference",
                        "const": "/warehouse/facility-layout",
                        "x-parser-schema-id": "<anonymous-schema-4>"
                      },
                      "type": {
                        "type": "string",
                        "description": "`com.warehouse.wms.facility-layout.<entity>.<EventName>`. Consumers dispatch on the full string.\n",
                        "x-parser-schema-id": "<anonymous-schema-5>"
                      },
                      "subject": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Id of the aggregate instance the event is about.",
                        "x-parser-schema-id": "<anonymous-schema-6>"
                      },
                      "time": {
                        "type": "string",
                        "format": "date-time",
                        "description": "When the domain fact occurred (not when it was published), UTC.",
                        "x-parser-schema-id": "<anonymous-schema-7>"
                      },
                      "datacontenttype": {
                        "type": "string",
                        "const": "application/json",
                        "x-parser-schema-id": "<anonymous-schema-8>"
                      },
                      "dataschema": {
                        "type": "string",
                        "format": "uri",
                        "description": "`urn:warehouse:facility-layout:events:<EventName>:v<N>` on this channel (`...:analytics:...` on warehouse.facility.analytics).\n",
                        "x-parser-schema-id": "<anonymous-schema-9>"
                      },
                      "data": {
                        "type": "object",
                        "description": "The domain event's own JSON payload.",
                        "x-parser-schema-id": "<anonymous-schema-10>"
                      }
                    },
                    "x-parser-schema-id": "cloudEvent"
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.site.SiteRegistered",
                        "x-parser-schema-id": "<anonymous-schema-12>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:SiteRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-13>"
                      },
                      "data": {
                        "allOf": [
                          {
                            "type": "object",
                            "description": "Fields present in every event's `data` payload — the domain event base struct's own serialization.\n",
                            "required": [
                              "eventName",
                              "eventType",
                              "occurredAt"
                            ],
                            "properties": {
                              "eventName": {
                                "type": "string",
                                "description": "The bare PascalCase event name.",
                                "x-parser-schema-id": "<anonymous-schema-15>"
                              },
                              "eventType": {
                                "type": "string",
                                "description": "Same reverse-DNS type as the CloudEvents `type` attribute.",
                                "x-parser-schema-id": "<anonymous-schema-16>"
                              },
                              "occurredAt": {
                                "type": "string",
                                "format": "date-time",
                                "x-parser-schema-id": "<anonymous-schema-17>"
                              }
                            },
                            "x-parser-schema-id": "eventDataBase"
                          },
                          {
                            "type": "object",
                            "required": [
                              "siteCode",
                              "siteName"
                            ],
                            "properties": {
                              "siteCode": {
                                "type": "string",
                                "description": "Uppercase alphanumeric, unique. e.g. `WH1`.",
                                "x-parser-schema-id": "<anonymous-schema-19>"
                              },
                              "siteName": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-20>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-18>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-14>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-11>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-1>"
              }
            },
            {
              "name": "ZoneRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Zone registered",
              "tags": [
                {
                  "name": "zone"
                }
              ],
              "summary": "A behavioral zone was added inside a Site's area.",
              "description": "Raised by `RegisterZone`. Kafka key: `zoneId`. **Consumed live** by inventory-storage's location-classification cache — the zone's `hazmat` and `temperatureClass` attributes are exactly what its StowStock placement check reads.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.zone.ZoneRegistered",
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:ZoneRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-24>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "zoneId",
                              "siteCode",
                              "areaCode",
                              "zoneCode",
                              "temperatureClass",
                              "hazmat"
                            ],
                            "properties": {
                              "zoneId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-27>"
                              },
                              "siteCode": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-28>"
                              },
                              "areaCode": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-29>"
                              },
                              "zoneCode": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-30>"
                              },
                              "temperatureClass": {
                                "type": "string",
                                "enum": [
                                  "Ambient",
                                  "Chilled",
                                  "Frozen"
                                ],
                                "description": "What a physical zone can hold, thermally.",
                                "x-parser-schema-id": "temperatureClass"
                              },
                              "hazmat": {
                                "type": "boolean",
                                "x-parser-schema-id": "<anonymous-schema-31>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-26>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-25>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-22>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-21>"
              }
            },
            {
              "name": "AisleRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Aisle registered",
              "tags": [
                {
                  "name": "aisle"
                }
              ],
              "summary": "A physical corridor was added inside a Zone.",
              "description": "Raised by `RegisterAisle`. Kafka key: `aisleId`. No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.aisle.AisleRegistered",
                        "x-parser-schema-id": "<anonymous-schema-34>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:AisleRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-35>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "aisleId",
                              "zoneId",
                              "aisleCode",
                              "sequenceHint",
                              "direction"
                            ],
                            "properties": {
                              "aisleId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-38>"
                              },
                              "zoneId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-39>"
                              },
                              "aisleCode": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-40>"
                              },
                              "sequenceHint": {
                                "type": "integer",
                                "description": "Walk-order position within the zone.",
                                "x-parser-schema-id": "<anonymous-schema-41>"
                              },
                              "direction": {
                                "type": "string",
                                "enum": [
                                  "OneWay",
                                  "TwoWay"
                                ],
                                "description": "How an aisle may be traversed.",
                                "x-parser-schema-id": "direction"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-37>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-36>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-32>"
              }
            },
            {
              "name": "LocationTypeRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Location type registered",
              "tags": [
                {
                  "name": "locationtype"
                }
              ],
              "summary": "A reusable slot shape/kind was defined.",
              "description": "Raised by `RegisterLocationType`. Kafka key: `locationType`. No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationtype.LocationTypeRegistered",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationTypeRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "locationType",
                              "maxWeightKg",
                              "maxVolumeM3"
                            ],
                            "properties": {
                              "locationType": {
                                "type": "string",
                                "description": "e.g. `PalletRack`, `ShelfBin`.",
                                "x-parser-schema-id": "<anonymous-schema-48>"
                              },
                              "role": {
                                "type": "string",
                                "description": "The LocationRole (ADR-0016): Storage, Dock, Yard, WorkCenter, Drop, Staging, QC, Consolidation, or Shipping. Added additively; absent on events emitted before this field existed, which consumers should treat as `Storage`.\n",
                                "x-parser-schema-id": "<anonymous-schema-49>"
                              },
                              "maxWeightKg": {
                                "type": "number",
                                "description": "0/absent for a role that does not require capacity (Dock, Yard, WorkCenter, QC, Shipping).\n",
                                "x-parser-schema-id": "<anonymous-schema-50>"
                              },
                              "maxVolumeM3": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-51>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-47>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-46>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-43>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-42>"
              }
            },
            {
              "name": "PlacementRuleDefined",
              "contentType": "application/cloudevents+json",
              "title": "Placement rule defined",
              "tags": [
                {
                  "name": "placementrule"
                }
              ],
              "summary": "A rule constraining which LocationTypes are legal in which Zones was declared.\n",
              "description": "Raised by `DefinePlacementRule`. Kafka key: `ruleId`. No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.placementrule.PlacementRuleDefined",
                        "x-parser-schema-id": "<anonymous-schema-54>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:PlacementRuleDefined:v1",
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "ruleId",
                              "locationType",
                              "effect",
                              "predicate"
                            ],
                            "properties": {
                              "ruleId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-58>"
                              },
                              "locationType": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-59>"
                              },
                              "effect": {
                                "type": "string",
                                "description": "Allow or deny.",
                                "x-parser-schema-id": "<anonymous-schema-60>"
                              },
                              "predicate": {
                                "type": "string",
                                "description": "The zone-matching predicate expression.",
                                "x-parser-schema-id": "<anonymous-schema-61>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-57>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-56>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-53>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-52>"
              }
            },
            {
              "name": "LocationSlotRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Location slot registered",
              "tags": [
                {
                  "name": "locationslot"
                }
              ],
              "summary": "A coded leaf slot now exists on the warehouse map.",
              "description": "Raised by `RegisterLocationSlot`, and once per successful row of `ImportFacilityLayout`. Kafka key: `locationCode`. **Consumed live** by inventory-storage's location-classification cache, which joins the slot to its parent zone's attributes via `zoneId`.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.LocationSlotRegistered",
                        "x-parser-schema-id": "<anonymous-schema-64>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationSlotRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-65>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
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
                              "locationCode": {
                                "type": "string",
                                "description": "The full coded location, e.g. `WH1-STOR-AMB-A07-03-02-B`.\n",
                                "x-parser-schema-id": "<anonymous-schema-68>"
                              },
                              "aisleId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-69>"
                              },
                              "zoneId": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-70>"
                              },
                              "locationType": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-71>"
                              },
                              "role": {
                                "type": "string",
                                "description": "The LocationRole (ADR-0016). Added additively; absent on events emitted before this field existed, which consumers should treat as `Storage`.\n",
                                "x-parser-schema-id": "<anonymous-schema-72>"
                              },
                              "dockFlow": {
                                "type": "string",
                                "description": "Inbound, Outbound, or Both. Present only when role is Dock (ADR-0016).\n",
                                "x-parser-schema-id": "<anonymous-schema-73>"
                              },
                              "activities": {
                                "type": "array",
                                "items": {
                                  "type": "string",
                                  "x-parser-schema-id": "<anonymous-schema-75>"
                                },
                                "description": "Pack, Sort, QC, VAS, Deconsolidate, Receive and/or Kit. Present only when role is WorkCenter (ADR-0016).\n",
                                "x-parser-schema-id": "<anonymous-schema-74>"
                              },
                              "maxWeightKg": {
                                "type": "number",
                                "description": "0/absent for a role that does not require capacity (Dock, Yard, WorkCenter, QC, Shipping).\n",
                                "x-parser-schema-id": "<anonymous-schema-76>"
                              },
                              "maxVolumeM3": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-77>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-67>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-66>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-63>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-62>"
              }
            },
            {
              "name": "LocationSlotDecommissioned",
              "contentType": "application/cloudevents+json",
              "title": "Location slot decommissioned",
              "tags": [
                {
                  "name": "locationslot"
                }
              ],
              "summary": "A coded slot was permanently retired.",
              "description": "Raised by `DecommissionLocationSlot`. Kafka key: `locationCode`. **Consumed live** by inventory-storage's location-classification cache, which evicts the slot (its stow placement check then fails open for that location, by design). Decommissioning is irreversible — there is no compensating event.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.LocationSlotDecommissioned",
                        "x-parser-schema-id": "<anonymous-schema-80>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationSlotDecommissioned:v1",
                        "x-parser-schema-id": "<anonymous-schema-81>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "locationCode"
                            ],
                            "properties": {
                              "locationCode": {
                                "type": "string",
                                "x-parser-schema-id": "<anonymous-schema-84>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-83>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-82>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-79>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-78>"
              }
            },
            {
              "name": "FacilityLayoutImported",
              "contentType": "application/cloudevents+json",
              "title": "Facility layout imported",
              "tags": [
                {
                  "name": "locationslot"
                }
              ],
              "summary": "A bulk layout import completed.",
              "description": "Raised once per `ImportFacilityLayout` call, summarising rows submitted/imported/rejected — in addition to, not instead of, the per-slot `LocationSlotRegistered` events for each successful row. Kafka key: the event type (no single aggregate identity); CloudEvents `subject`: the fixed batch identity `layout-import`. No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.FacilityLayoutImported",
                        "x-parser-schema-id": "<anonymous-schema-87>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:FacilityLayoutImported:v1",
                        "x-parser-schema-id": "<anonymous-schema-88>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "rowsSubmitted",
                              "slotsImported",
                              "rowsRejected"
                            ],
                            "properties": {
                              "rowsSubmitted": {
                                "type": "integer",
                                "x-parser-schema-id": "<anonymous-schema-91>"
                              },
                              "slotsImported": {
                                "type": "integer",
                                "x-parser-schema-id": "<anonymous-schema-92>"
                              },
                              "rowsRejected": {
                                "type": "integer",
                                "x-parser-schema-id": "<anonymous-schema-93>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-90>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-89>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-86>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-85>"
              }
            },
            {
              "name": "LocationGeometryUpdated",
              "contentType": "application/cloudevents+json",
              "title": "Location geometry updated",
              "tags": [
                {
                  "name": "locationslot"
                }
              ],
              "summary": "A coded slot's physical position/footprint was set or changed.",
              "description": "Raised by `SetLocationGeometry` (ADR-0017). CloudEvents `subject`: `locationCode`. Kafka key: the event type (`aggregateKey` fallback). No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.locationslot.LocationGeometryUpdated",
                        "x-parser-schema-id": "<anonymous-schema-96>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:LocationGeometryUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-97>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "locationCode",
                              "xM",
                              "yM",
                              "zM",
                              "widthM",
                              "depthM",
                              "heightM"
                            ],
                            "properties": {
                              "locationCode": {
                                "type": "string",
                                "description": "The full coded location, e.g. `WH1-STOR-AMB-A07-03-02-B`.\n",
                                "x-parser-schema-id": "<anonymous-schema-100>"
                              },
                              "xM": {
                                "type": "number",
                                "description": "Position in the site's local coordinate frame, in metres.",
                                "x-parser-schema-id": "<anonymous-schema-101>"
                              },
                              "yM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-102>"
                              },
                              "zM": {
                                "type": "number",
                                "description": "Height above floor level, in metres. Never negative.",
                                "x-parser-schema-id": "<anonymous-schema-103>"
                              },
                              "widthM": {
                                "type": "number",
                                "description": "Footprint extent, in metres. Always strictly positive.",
                                "x-parser-schema-id": "<anonymous-schema-104>"
                              },
                              "depthM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-105>"
                              },
                              "heightM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-106>"
                              },
                              "pickSequence": {
                                "type": "integer",
                                "description": "Optional explicit pick-path override for this slot. Absent when no override was given.\n",
                                "x-parser-schema-id": "<anonymous-schema-107>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-99>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-98>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-95>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-94>"
              }
            },
            {
              "name": "AisleGeometryUpdated",
              "contentType": "application/cloudevents+json",
              "title": "Aisle geometry updated",
              "tags": [
                {
                  "name": "aisle"
                }
              ],
              "summary": "An aisle's travel centreline was set or changed.",
              "description": "Raised by `SetAisleGeometry` (ADR-0017): the straight-line path the travel graph uses as this aisle's walkable route. CloudEvents `subject`: `aisleId`. Kafka key: the event type (`aggregateKey` fallback). No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.aisle.AisleGeometryUpdated",
                        "x-parser-schema-id": "<anonymous-schema-110>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:AisleGeometryUpdated:v1",
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "aisleId",
                              "startXM",
                              "startYM",
                              "startZM",
                              "endXM",
                              "endYM",
                              "endZM",
                              "lengthM"
                            ],
                            "properties": {
                              "aisleId": {
                                "type": "string",
                                "example": "WH1-STOR-AMB-A07",
                                "x-parser-schema-id": "<anonymous-schema-114>"
                              },
                              "startXM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-115>"
                              },
                              "startYM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-116>"
                              },
                              "startZM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-117>"
                              },
                              "endXM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-118>"
                              },
                              "endYM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-119>"
                              },
                              "endZM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-120>"
                              },
                              "lengthM": {
                                "type": "number",
                                "description": "The centreline's straight-line length, in metres.",
                                "x-parser-schema-id": "<anonymous-schema-121>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-113>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-109>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-108>"
              }
            },
            {
              "name": "FixedStructureRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Fixed structure registered",
              "tags": [
                {
                  "name": "structure"
                }
              ],
              "summary": "A site-scoped physical obstacle was added to the warehouse map.",
              "description": "Raised by `RegisterFixedStructure` (ADR-0017): a wall, column, office, conveyor, or other fixed object. Not a location — nothing can be stowed at it. CloudEvents `subject`: `structureId`. Kafka key: the event type (`aggregateKey` fallback). No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.structure.FixedStructureRegistered",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:FixedStructureRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "structureId",
                              "siteCode",
                              "kind",
                              "xM",
                              "yM",
                              "zM",
                              "widthM",
                              "depthM",
                              "heightM",
                              "label"
                            ],
                            "properties": {
                              "structureId": {
                                "type": "string",
                                "example": "STR-1",
                                "x-parser-schema-id": "<anonymous-schema-128>"
                              },
                              "siteCode": {
                                "type": "string",
                                "example": "WH1",
                                "x-parser-schema-id": "<anonymous-schema-129>"
                              },
                              "kind": {
                                "type": "string",
                                "description": "Wall, Column, Office, Conveyor, or Other.",
                                "x-parser-schema-id": "<anonymous-schema-130>"
                              },
                              "xM": {
                                "type": "number",
                                "description": "Footprint origin, in the site's local coordinate frame, in metres.",
                                "x-parser-schema-id": "<anonymous-schema-131>"
                              },
                              "yM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-132>"
                              },
                              "zM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-133>"
                              },
                              "widthM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-134>"
                              },
                              "depthM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-135>"
                              },
                              "heightM": {
                                "type": "number",
                                "x-parser-schema-id": "<anonymous-schema-136>"
                              },
                              "label": {
                                "type": "string",
                                "example": "North wall",
                                "x-parser-schema-id": "<anonymous-schema-137>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-127>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-126>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-123>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-122>"
              }
            },
            {
              "name": "CrossAisleRegistered",
              "contentType": "application/cloudevents+json",
              "title": "Cross-aisle registered",
              "tags": [
                {
                  "name": "crossaisle"
                }
              ],
              "summary": "A connection between two aisles was added to the travel graph.",
              "description": "Raised by `RegisterCrossAisle` (ADR-0017): a zone-scoped connection between two of its aisles at a bay ordinal, letting the travel graph route between aisles without walking to either end. CloudEvents `subject`: `<zoneId>/<fromAisle>-<toAisle>@<atBay>` (the cross-aisle's composite identity). Kafka key: the event type (`aggregateKey` fallback). No consumer wired today.\n",
              "payload": {
                "allOf": [
                  "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "const": "com.warehouse.wms.facility-layout.crossaisle.CrossAisleRegistered",
                        "x-parser-schema-id": "<anonymous-schema-140>"
                      },
                      "dataschema": {
                        "const": "urn:warehouse:facility-layout:events:CrossAisleRegistered:v1",
                        "x-parser-schema-id": "<anonymous-schema-141>"
                      },
                      "data": {
                        "allOf": [
                          "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
                          {
                            "type": "object",
                            "required": [
                              "zoneId",
                              "fromAisle",
                              "toAisle",
                              "atBay"
                            ],
                            "properties": {
                              "zoneId": {
                                "type": "string",
                                "example": "WH1-STOR-AMB",
                                "x-parser-schema-id": "<anonymous-schema-144>"
                              },
                              "fromAisle": {
                                "type": "string",
                                "example": "A07",
                                "x-parser-schema-id": "<anonymous-schema-145>"
                              },
                              "toAisle": {
                                "type": "string",
                                "example": "A08",
                                "x-parser-schema-id": "<anonymous-schema-146>"
                              },
                              "atBay": {
                                "type": "string",
                                "example": "02",
                                "x-parser-schema-id": "<anonymous-schema-147>"
                              }
                            },
                            "x-parser-schema-id": "<anonymous-schema-143>"
                          }
                        ],
                        "x-parser-schema-id": "<anonymous-schema-142>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-139>"
                  }
                ],
                "x-parser-schema-id": "<anonymous-schema-138>"
              }
            }
          ]
        }
      }
    },
    "warehouse.facility.analytics": {
      "description": "The analytics topic of this bounded context (ADR-0010), named after the `AnalyticsTopic` constant in `internal/adapters/outbound/kafka/analytics_publisher.go` (`warehouse.facility.analytics`). The composition root fans EVERY domain event out to it alongside the integration topic when `EVENT_PUBLISHER=kafka` and `analytics.enabled` — same CloudEvent `type` and `id` per occurrence, with `dataschema=urn:warehouse:facility-layout:analytics:<EventName>:v1`. It is NOT part of the cross-context integration contract: it exists so this service's own analytical read model (the \"Layout Catalog Growth & Change\" data product) can evolve independently of the OLTP Published Language. Cross-context consumers should subscribe to `warehouse.facility.events`, not here.\n",
      "subscribe": {
        "operationId": "onFacilityAnalyticsEvent",
        "summary": "Consume facility-layout's analytics stream (internal data product).",
        "description": "The only supported consumer is this service's own `cmd/facility-projector` (single writer of the analytical database, ADR-0010). It follows the same at-least-once discipline: per-process-unique consumer group, FirstOffset replay, idempotent projection keyed on the CloudEvent `id`, readiness gated on catching up to the high watermark observed at start.\n",
        "message": {
          "oneOf": [
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[1]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[2]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[3]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[4]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[5]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[6]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[7]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[8]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[9]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[10]",
            "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[11]"
          ]
        }
      }
    }
  },
  "components": {
    "schemas": {
      "cloudEvent": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[0]",
      "eventDataBase": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0].payload.allOf[1].properties.data.allOf[0]",
      "temperatureClass": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[1].payload.allOf[1].properties.data.allOf[1].properties.temperatureClass",
      "direction": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[2].payload.allOf[1].properties.data.allOf[1].properties.direction"
    },
    "messages": {
      "siteRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[0]",
      "zoneRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[1]",
      "aisleRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[2]",
      "locationTypeRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[3]",
      "placementRuleDefined": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[4]",
      "locationSlotRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[5]",
      "locationSlotDecommissioned": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[6]",
      "facilityLayoutImported": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[7]",
      "locationGeometryUpdated": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[8]",
      "aisleGeometryUpdated": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[9]",
      "fixedStructureRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[10]",
      "crossAisleRegistered": "$ref:$.channels.warehouse.facility.events.subscribe.message.oneOf[11]"
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
  