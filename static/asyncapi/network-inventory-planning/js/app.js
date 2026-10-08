
    const schema = {
  "asyncapi": "3.0.0",
  "info": {
    "title": "network-inventory-planning events",
    "version": "1.0.0",
    "contact": {
      "name": "warehouse-systems",
      "url": "https://github.com/IQVO/network-inventory-planning",
      "email": "warehouse-systems@warehouse-systems.internal"
    },
    "license": {
      "name": "MIT"
    },
    "tags": [
      {
        "name": "consumed-facts",
        "description": "Sibling-context facts projected into local read models."
      },
      {
        "name": "consumed-replies",
        "description": "inventory-storage's transfer-allocation replies driving the saga."
      },
      {
        "name": "published",
        "description": "This context's published transfer saga events and commands."
      },
      {
        "name": "published-analytics",
        "description": "This context's saga-health analytics occurrences (ADR 0007, observe-only)."
      }
    ],
    "description": "Event contract of the network-inventory-planning bounded context.\n\n**Phase 1** declares the three CONSUMED facts (projected into local\nread models):\n\n- `com.warehouse.wms.facility-layout.site.SiteCapabilityChanged`\n  (facility-layout, `warehouse.facility.events`) → local\n  `site_capability` read model (keyed site_id, LWW on\n  capability_revision).\n- `com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged`\n  (order-management, `warehouse.order-management.events`) → local\n  `site_sku_demand` read model (keyed source_order_id+line_no, state\n  ACTIVE/REMOVED).\n- `com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished`\n  (warehouse-planning, `warehouse.warehouse-planning.events`) → local\n  `published_capacity_plan` read model (keyed plan_id, LWW on the\n  CloudEvents time. The payload is warehouse-planning's existing v1\n  payload plus the additive `site_id`; a legacy event WITHOUT `site_id`\n  is EXCLUDED (the site is never inferred from warehouse_id).\n\n**Phase 2 (ADR 0003, the transfer saga)** adds the PUBLISHED stream on\n`warehouse.network-inventory-planning.events` — emitted through the\ntransactional outbox in the same transaction as the saga state change —\nand the two CONSUMED inventory-storage replies on\n`warehouse.inventory.events`:\n\n- `com.warehouse.wes.network-inventory-planning.transfer.TransferPlanApproved`\n  (published, subject/key transfer_id): an operator approved an\n  advisory proposal into a transfer plan.\n- `com.warehouse.wes.network-inventory-planning.transfer.TransferAllocationRequested`\n  (published COMMAND, subject/key `transfer_line_id` = `<transfer_id>:1`\n  for the v1 single-line saga): inventory-storage allocates origin\n  stock against `transfer_line_id` and replies on\n  `warehouse.inventory.events`.\n- `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated`\n  (consumed reply, subject/key reservation_id): the saga moves\n  ALLOCATING → ALLOCATED, persisting reservation_id, allocations[] and\n  expires_at.\n- `com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected`\n  (consumed reply, subject/key transfer_line_id): the saga moves\n  ALLOCATING → UNFULFILLABLE with the closed reason\n  ORIGIN_SITE_UNKNOWN|INSUFFICIENT_USABLE|IDEMPOTENCY_CONFLICT.\n\n**Phase 4 (ADR 0007, observability + scheduled runs)** adds this\ncontext's analytics stream on\n`warehouse.network-inventory-planning.analytics`: the saga-health\noccurrences `TransferStateAdvanced` (every state transition, same\noutbox transaction), `TransferStuckDetected` (a bounded observe-only\nticker; NIP_HEALTH_CHECK_INTERVAL / NIP_STUCK_THRESHOLDS) and\n`RebalanceRunCompleted` (each scheduled rebalance pass; observe-only\n— no approval, no allocation command). W3C trace context\n(`traceparent`) propagates on every produced and consumed message.\n\n**Phase 3 (ADR 0005, work-demand release + fact-driven transitions)**\nadds the released work demands on the PUBLISHED stream, the three\nCONSUMED fulfillment-execution transfer facts on\n`warehouse.fulfillment.events`, and the two CONSUMED\ninventory-storage destination facts on `warehouse.inventory.events`:\n\n- `com.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased`\n  (published COMMAND, subject/key `demand_id`): one leg of an approved\n  transfer released for warehouse work. WES (wes-work-planning) is the\n  consumer; the payload below mirrors ITS consumed contract exactly.\n- `com.warehouse.wes.fulfillment-execution.transfer.TransferPicked`\n  (consumed fact, subject/key task_id): ALLOCATED → PICKED, the\n  picked quantity recorded (a short pick is recorded, not refused),\n  and the dispatch WorkDemandReleased released with the PICKED\n  quantity.\n- `com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched`\n  (consumed fact, subject/key task_id): PICKED → IN_TRANSIT.\n- `com.warehouse.wes.fulfillment-execution.transfer.TransferArrived`\n  (consumed fact, RESERVED — scan-driven receiving may bypass it):\n  IN_TRANSIT → ARRIVED; inventory-storage's TransferReceiptStaged\n  drives the same transition.\n- `com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged`\n  (consumed fact, subject/key transfer_line_id): IN_TRANSIT → ARRIVED\n  (the scan-driven receiving path).\n- `com.warehouse.wms.inventory-storage.stock.TransferStockStowed`\n  (consumed fact, subject/key transfer_line_id): ARRIVED → RECEIVED\n  (terminal), the destination stow allocations persisted.\n\nConsumers decode CloudEvents 1.0 structured mode only, dispatch on the\nFULL `type`, ignore unknown types, dedupe on `id` in-transaction\n(processed_events), and commit offsets only after the read-model\ntransaction commits. Consumer group ids are environment-configured\n(SITE_CAPABILITY_CONSUMER_GROUP, SITE_SKU_DEMAND_CONSUMER_GROUP,\nCAPACITY_PLAN_CONSUMER_GROUP, TRANSFER_REPLY_CONSUMER_GROUP,\nTRANSFER_FACT_CONSUMER_GROUP); unset means the consumer does not\nexist. A fact whose transfer_ref names no known transfer is\nWARN-logged and committed past, never retried.\n\nThe consumed payload schemas below are the producers' own contract\nshapes mirrored read-only (each producer's apis/asyncapi.yaml on\norigin/develop is authoritative).\n"
  },
  "servers": {
    "production": {
      "host": "kafka.warehouse-systems.internal:9092",
      "protocol": "kafka",
      "description": "Fleet-shared Kafka broker."
    }
  },
  "defaultContentType": "application/cloudevents+json",
  "channels": {
    "warehouse.facility.events": {
      "address": "warehouse.facility.events",
      "title": "facility-layout integration topic",
      "description": "facility-layout's integration stream. network-inventory-planning\nconsumes only SiteCapabilityChanged and ignores every other type.\n",
      "messages": {
        "siteCapabilityChanged": {
          "name": "SiteCapabilityChanged",
          "title": "Site capability changed",
          "summary": "A site's transfer capability state changed (consumed).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of facility-layout's SiteCapabilityChanged.",
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
                    "const": "1.0",
                    "x-parser-schema-id": "<anonymous-schema-1>"
                  },
                  "id": {
                    "type": "string",
                    "description": "UUID; the consumer's dedupe key.",
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
                    "x-parser-schema-id": "<anonymous-schema-5>"
                  },
                  "time": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-6>"
                  },
                  "datacontenttype": {
                    "const": "application/json",
                    "x-parser-schema-id": "<anonymous-schema-7>"
                  },
                  "dataschema": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-8>"
                  },
                  "data": {
                    "type": "object",
                    "x-parser-schema-id": "<anonymous-schema-9>"
                  }
                },
                "x-parser-schema-id": "cloudEvent"
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wms.facility-layout.site.SiteCapabilityChanged",
                    "x-parser-schema-id": "<anonymous-schema-11>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:facility-layout:events:SiteCapabilityChanged:v1",
                    "x-parser-schema-id": "<anonymous-schema-12>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "site_code",
                      "transfer_origin_enabled",
                      "transfer_destination_enabled",
                      "capability_revision"
                    ],
                    "properties": {
                      "site_code": {
                        "type": "string",
                        "description": "The site identity; also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-14>"
                      },
                      "transfer_origin_enabled": {
                        "type": "boolean",
                        "x-parser-schema-id": "<anonymous-schema-15>"
                      },
                      "transfer_destination_enabled": {
                        "type": "boolean",
                        "x-parser-schema-id": "<anonymous-schema-16>"
                      },
                      "capability_revision": {
                        "type": "integer",
                        "format": "int64",
                        "description": "Monotonically increasing; LWW tiebreaker.",
                        "x-parser-schema-id": "<anonymous-schema-17>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-13>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-10>"
              }
            ],
            "x-parser-schema-id": "SiteCapabilityChangedEvent"
          },
          "x-parser-unique-object-id": "siteCapabilityChanged"
        }
      },
      "x-parser-unique-object-id": "warehouse.facility.events"
    },
    "warehouse.order-management.events": {
      "address": "warehouse.order-management.events",
      "title": "order-management integration topic",
      "description": "order-management's integration stream. network-inventory-planning\nconsumes only SiteSkuDemandChanged and ignores every other type.\n",
      "messages": {
        "siteSkuDemandChanged": {
          "name": "SiteSkuDemandChanged",
          "title": "Site/SKU demand changed",
          "summary": "One source order line's site demand changed (consumed).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of order-management's SiteSkuDemandChanged.",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.order-management.siteskudemand.SiteSkuDemandChanged",
                    "x-parser-schema-id": "<anonymous-schema-19>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:order-management:events:SiteSkuDemandChanged:v1",
                    "x-parser-schema-id": "<anonymous-schema-20>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "source_order_id",
                      "line_no",
                      "site_id",
                      "sku",
                      "demanded_units",
                      "due_at",
                      "state",
                      "assignment_version"
                    ],
                    "properties": {
                      "source_order_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-22>"
                      },
                      "line_no": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-23>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-24>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-25>"
                      },
                      "demanded_units": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-26>"
                      },
                      "due_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-27>"
                      },
                      "state": {
                        "type": "string",
                        "enum": [
                          "ACTIVE",
                          "REMOVED"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-28>"
                      },
                      "assignment_version": {
                        "type": "string",
                        "description": "order-management's site-assignment policy version (\"static-site-v1\").",
                        "x-parser-schema-id": "<anonymous-schema-29>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-21>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-18>"
              }
            ],
            "x-parser-schema-id": "SiteSkuDemandChangedEvent"
          },
          "x-parser-unique-object-id": "siteSkuDemandChanged"
        }
      },
      "x-parser-unique-object-id": "warehouse.order-management.events"
    },
    "warehouse.warehouse-planning.events": {
      "address": "warehouse.warehouse-planning.events",
      "title": "warehouse-planning integration topic",
      "description": "warehouse-planning's integration stream. network-inventory-planning\nconsumes only CapacityPlanPublished and ignores every other type.\n",
      "messages": {
        "capacityPlanPublished": {
          "name": "CapacityPlanPublished",
          "title": "Capacity plan published",
          "summary": "A capacity plan was published (consumed).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of warehouse-planning's CapacityPlanPublished (v1 payload + additive site_id).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.warehouse-planning.capacityplan.CapacityPlanPublished",
                    "x-parser-schema-id": "<anonymous-schema-31>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:warehouse-planning:events:CapacityPlanPublished:v1",
                    "x-parser-schema-id": "<anonymous-schema-32>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "plan_id",
                      "site_id",
                      "location",
                      "path_id",
                      "window_start",
                      "window_end",
                      "assigned_demand",
                      "path_capacity",
                      "capacity_over_window",
                      "shortage",
                      "bottleneck_step",
                      "published_at"
                    ],
                    "properties": {
                      "plan_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-34>"
                      },
                      "site_id": {
                        "type": "string",
                        "description": "Additive Phase-1 field. A legacy event without it is EXCLUDED by this consumer, never defaulted or inferred.",
                        "x-parser-schema-id": "<anonymous-schema-35>"
                      },
                      "location": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-36>"
                      },
                      "path_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-37>"
                      },
                      "window_start": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Planning window start (RFC 3339, UTC). The window is [window_start, window_end).",
                        "x-parser-schema-id": "<anonymous-schema-38>"
                      },
                      "window_end": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Planning window end, EXCLUSIVE.",
                        "x-parser-schema-id": "<anonymous-schema-39>"
                      },
                      "assigned_demand": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-40>"
                      },
                      "path_capacity": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-41>"
                      },
                      "capacity_over_window": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-42>"
                      },
                      "shortage": {
                        "type": "number",
                        "format": "double",
                        "x-parser-schema-id": "<anonymous-schema-43>"
                      },
                      "bottleneck_step": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-44>"
                      },
                      "published_at": {
                        "type": "string",
                        "format": "date-time",
                        "x-parser-schema-id": "<anonymous-schema-45>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-30>"
              }
            ],
            "x-parser-schema-id": "CapacityPlanPublishedEvent"
          },
          "x-parser-unique-object-id": "capacityPlanPublished"
        }
      },
      "x-parser-unique-object-id": "warehouse.warehouse-planning.events"
    },
    "warehouse.network-inventory-planning.events": {
      "address": "warehouse.network-inventory-planning.events",
      "title": "network-inventory-planning integration topic",
      "description": "This context's OWN integration stream (Phase 2). Everything on it is\nemitted through the transactional outbox: the saga state change and\nthe outbox row commit in one transaction, and a background relay\npublishes afterwards — a request handler never sends directly.\n",
      "messages": {
        "transferPlanApproved": {
          "name": "TransferPlanApproved",
          "title": "Transfer plan approved",
          "summary": "An operator approved an advisory proposal into a transfer plan (published).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's TransferPlanApproved (published via the transactional outbox).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.transfer.TransferPlanApproved",
                    "x-parser-schema-id": "<anonymous-schema-47>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:events:TransferPlanApproved:v1",
                    "x-parser-schema-id": "<anonymous-schema-48>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "transfer_id",
                      "origin_site_id",
                      "destination_site_id",
                      "sku",
                      "quantity",
                      "policy_version",
                      "proposal_as_of"
                    ],
                    "properties": {
                      "transfer_id": {
                        "type": "string",
                        "description": "The saga aggregate id; also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-50>"
                      },
                      "origin_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-51>"
                      },
                      "destination_site_id": {
                        "type": "string",
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
                      "policy_version": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-55>"
                      },
                      "operator_reason": {
                        "type": "string",
                        "description": "The operator's captured approval reason (may be empty).",
                        "x-parser-schema-id": "<anonymous-schema-56>"
                      },
                      "proposal_as_of": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The advisory proposal snapshot's as-of watermark (RFC 3339, UTC).",
                        "x-parser-schema-id": "<anonymous-schema-57>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-49>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-46>"
              }
            ],
            "x-parser-schema-id": "TransferPlanApprovedEvent"
          },
          "x-parser-unique-object-id": "transferPlanApproved"
        },
        "transferAllocationRequested": {
          "name": "TransferAllocationRequested",
          "title": "Transfer allocation requested",
          "summary": "Command inventory-storage to allocate origin stock for a transfer line (published).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's TransferAllocationRequested\nCOMMAND (published via the transactional outbox). The data payload is\nEXACTLY inventory-storage's consumed contract — five fields, no more.\n",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.transfer.TransferAllocationRequested",
                    "x-parser-schema-id": "<anonymous-schema-59>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:events:TransferAllocationRequested:v1",
                    "x-parser-schema-id": "<anonymous-schema-60>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "transfer_id",
                      "transfer_line_id",
                      "origin_site_id",
                      "sku",
                      "quantity"
                    ],
                    "properties": {
                      "transfer_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-62>"
                      },
                      "transfer_line_id": {
                        "type": "string",
                        "description": "\"<transfer_id>:1\" in v1's single-line saga; also the Kafka\nkey and subject, and inventory-storage's allocation-ledger\nand reply-correlation key.\n",
                        "x-parser-schema-id": "<anonymous-schema-63>"
                      },
                      "origin_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-64>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-65>"
                      },
                      "quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-66>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-61>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-58>"
              }
            ],
            "x-parser-schema-id": "TransferAllocationRequestedEvent"
          },
          "x-parser-unique-object-id": "transferAllocationRequested"
        },
        "workDemandReleased": {
          "name": "WorkDemandReleased",
          "title": "Work demand released",
          "summary": "One leg of an approved transfer released for warehouse work (published).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's WorkDemandReleased\nCOMMAND (published via the transactional outbox, ADR 0005). The\ndata payload is EXACTLY WES's (wes-work-planning) consumed\ncontract, mirrored read-only from its apis/asyncapi.yaml — every\ndata field is required by the producer.\n",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.workdemand.WorkDemandReleased",
                    "x-parser-schema-id": "<anonymous-schema-68>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:events:WorkDemandReleased:v1",
                    "x-parser-schema-id": "<anonymous-schema-69>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "demand_id",
                      "work_kind",
                      "transfer_ref",
                      "path_id",
                      "site_id",
                      "cpt",
                      "sku",
                      "quantity"
                    ],
                    "properties": {
                      "demand_id": {
                        "type": "string",
                        "description": "Deterministic identity of the leg — `<transfer_id>:pick`\nor `<transfer_id>:dispatch`. Also the Kafka key and\nsubject; WES mints its work unit under it.\n",
                        "x-parser-schema-id": "<anonymous-schema-71>"
                      },
                      "work_kind": {
                        "type": "string",
                        "enum": [
                          "TRANSFER_PICK",
                          "TRANSFER_DISPATCH",
                          "TRANSFER_ARRIVAL"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-72>"
                      },
                      "transfer_ref": {
                        "type": "string",
                        "description": "The transfer saga's correlation id.",
                        "x-parser-schema-id": "<anonymous-schema-73>"
                      },
                      "path_id": {
                        "type": "string",
                        "description": "Process path the leg executes on, from deployment\nconfiguration (TRANSFER_PICK_PATH_ID /\nTRANSFER_DISPATCH_PATH_ID); WES validates it against\nits PathCatalogue.\n",
                        "x-parser-schema-id": "<anonymous-schema-74>"
                      },
                      "site_id": {
                        "type": "string",
                        "description": "Network site anchoring the leg — the ORIGIN for pick and dispatch.",
                        "x-parser-schema-id": "<anonymous-schema-75>"
                      },
                      "cpt": {
                        "type": "string",
                        "format": "date-time",
                        "description": "Critical Pull Time: the triggering fact's time plus the\nleg's configured TRANSFER_*_CPT_OFFSET.\n",
                        "x-parser-schema-id": "<anonymous-schema-76>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-77>"
                      },
                      "quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "Units the leg moves — the allocated quantity for the\npick leg, the PICKED quantity for the dispatch leg\n(short picks dispatch what was actually picked).\n",
                        "x-parser-schema-id": "<anonymous-schema-78>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-70>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-67>"
              }
            ],
            "x-parser-schema-id": "WorkDemandReleasedEvent"
          },
          "x-parser-unique-object-id": "workDemandReleased"
        }
      },
      "x-parser-unique-object-id": "warehouse.network-inventory-planning.events"
    },
    "warehouse.network-inventory-planning.analytics": {
      "address": "warehouse.network-inventory-planning.analytics",
      "title": "network-inventory-planning analytics topic",
      "description": "This context's dedicated analytics stream (ADR 0007): saga-health\noccurrences only, never OLTP commands. Published through the same\ntransactional outbox as the integration events, on separate rows\nwith their own topic, so the integration contract and the health\nsignal evolve independently.\n",
      "messages": {
        "transferStateAdvanced": {
          "name": "TransferStateAdvanced",
          "title": "Transfer state advanced",
          "summary": "One saga state transition, as a health-analytics occurrence (published).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's TransferStateAdvanced analytics occurrence (ADR 0007, published via the transactional outbox in the same transaction as the transition).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.saga.TransferStateAdvanced",
                    "x-parser-schema-id": "<anonymous-schema-80>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:analytics:TransferStateAdvanced:v1",
                    "x-parser-schema-id": "<anonymous-schema-81>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "transfer_id",
                      "from",
                      "to",
                      "age_seconds"
                    ],
                    "properties": {
                      "transfer_id": {
                        "type": "string",
                        "description": "The saga aggregate id; also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-83>"
                      },
                      "from": {
                        "type": "string",
                        "description": "The state before the transition (empty string for the creation entry).",
                        "x-parser-schema-id": "<anonymous-schema-84>"
                      },
                      "to": {
                        "type": "string",
                        "enum": [
                          "DRAFT",
                          "PROPOSED",
                          "APPROVED",
                          "ALLOCATING",
                          "ALLOCATED",
                          "PICKED",
                          "IN_TRANSIT",
                          "ARRIVED",
                          "RECEIVED",
                          "UNFULFILLABLE",
                          "CANCELLED"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-85>"
                      },
                      "age_seconds": {
                        "type": "integer",
                        "format": "int64",
                        "description": "Seconds since the aggregate's creation at the moment of the transition.",
                        "x-parser-schema-id": "<anonymous-schema-86>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-82>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-79>"
              }
            ],
            "x-parser-schema-id": "TransferStateAdvancedEvent"
          },
          "x-parser-unique-object-id": "transferStateAdvanced"
        },
        "transferStuckDetected": {
          "name": "TransferStuckDetected",
          "title": "Transfer stuck detected",
          "summary": "A non-terminal transfer aged past its per-state threshold (published, observe-only).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's TransferStuckDetected analytics occurrence (ADR 0007, published by the bounded observe-only health ticker).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.saga.TransferStuckDetected",
                    "x-parser-schema-id": "<anonymous-schema-88>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:analytics:TransferStuckDetected:v1",
                    "x-parser-schema-id": "<anonymous-schema-89>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "transfer_id",
                      "state",
                      "age_seconds",
                      "threshold_seconds"
                    ],
                    "properties": {
                      "transfer_id": {
                        "type": "string",
                        "description": "The saga aggregate id; also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-91>"
                      },
                      "state": {
                        "type": "string",
                        "description": "The non-terminal state the transfer is stuck in.",
                        "x-parser-schema-id": "<anonymous-schema-92>"
                      },
                      "age_seconds": {
                        "type": "integer",
                        "format": "int64",
                        "description": "Seconds since the transfer's last transition (updated_at).",
                        "x-parser-schema-id": "<anonymous-schema-93>"
                      },
                      "threshold_seconds": {
                        "type": "integer",
                        "format": "int64",
                        "description": "The per-state threshold that was exceeded (NIP_STUCK_THRESHOLDS or the default).",
                        "x-parser-schema-id": "<anonymous-schema-94>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-90>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-87>"
              }
            ],
            "x-parser-schema-id": "TransferStuckDetectedEvent"
          },
          "x-parser-unique-object-id": "transferStuckDetected"
        },
        "rebalanceRunCompleted": {
          "name": "RebalanceRunCompleted",
          "title": "Rebalance run completed",
          "summary": "One scheduled (observe-only) rebalance pass (published).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of this context's RebalanceRunCompleted analytics occurrence (ADR 0007, one per scheduled observe-only rebalance pass).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.network-inventory-planning.saga.RebalanceRunCompleted",
                    "x-parser-schema-id": "<anonymous-schema-96>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:network-inventory-planning:analytics:RebalanceRunCompleted:v1",
                    "x-parser-schema-id": "<anonymous-schema-97>"
                  },
                  "data": {
                    "type": "object",
                    "required": [
                      "run_id",
                      "proposal_count",
                      "rejected_count",
                      "stale_facts"
                    ],
                    "properties": {
                      "run_id": {
                        "type": "string",
                        "description": "The run's identity; also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-99>"
                      },
                      "proposal_count": {
                        "type": "integer",
                        "description": "Proposals the planner produced this pass.",
                        "x-parser-schema-id": "<anonymous-schema-100>"
                      },
                      "rejected_count": {
                        "type": "integer",
                        "description": "Proposals the run's own safety checks refused (never an operator rejection; the run approves nothing).",
                        "x-parser-schema-id": "<anonymous-schema-101>"
                      },
                      "stale_facts": {
                        "type": "integer",
                        "description": "Facts excluded by freshness in this pass (0 while the snapshot is fully fresh).",
                        "x-parser-schema-id": "<anonymous-schema-102>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-98>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-95>"
              }
            ],
            "x-parser-schema-id": "RebalanceRunCompletedEvent"
          },
          "x-parser-unique-object-id": "rebalanceRunCompleted"
        }
      },
      "x-parser-unique-object-id": "warehouse.network-inventory-planning.analytics"
    },
    "warehouse.inventory.events": {
      "address": "warehouse.inventory.events",
      "title": "inventory-storage integration topic",
      "description": "inventory-storage's integration stream. network-inventory-planning\nconsumes only the two transfer-allocation replies and the two\ndestination facts; every other type is ignored.\n",
      "messages": {
        "transferStockAllocated": {
          "name": "TransferStockAllocated",
          "title": "Transfer stock allocated",
          "summary": "inventory-storage allocated origin stock for a transfer line (consumed reply).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of inventory-storage's TransferStockAllocated reply (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocated",
                    "x-parser-schema-id": "<anonymous-schema-104>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:inventory-storage:events:TransferStockAllocated:v1",
                    "x-parser-schema-id": "<anonymous-schema-105>"
                  },
                  "data": {
                    "type": "object",
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
                        "x-parser-schema-id": "<anonymous-schema-107>"
                      },
                      "transfer_line_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-108>"
                      },
                      "origin_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-109>"
                      },
                      "reservation_id": {
                        "type": "string",
                        "description": "Also the Kafka key and subject of the reply.",
                        "x-parser-schema-id": "<anonymous-schema-110>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-111>"
                      },
                      "quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-112>"
                      },
                      "allocations": {
                        "type": "array",
                        "minItems": 1,
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
                              "x-parser-schema-id": "<anonymous-schema-115>"
                            },
                            "bin_id": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-116>"
                            },
                            "quantity": {
                              "type": "integer",
                              "minimum": 1,
                              "x-parser-schema-id": "<anonymous-schema-117>"
                            }
                          },
                          "x-parser-schema-id": "<anonymous-schema-114>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-113>"
                      },
                      "expires_at": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The origin reservation's expiry.",
                        "x-parser-schema-id": "<anonymous-schema-118>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-106>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-103>"
              }
            ],
            "x-parser-schema-id": "TransferStockAllocatedEvent"
          },
          "x-parser-unique-object-id": "transferStockAllocated"
        },
        "transferStockAllocationRejected": {
          "name": "TransferStockAllocationRejected",
          "title": "Transfer stock allocation rejected",
          "summary": "inventory-storage refused a transfer-line allocation (consumed reply).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of inventory-storage's TransferStockAllocationRejected reply (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wms.inventory-storage.reservation.TransferStockAllocationRejected",
                    "x-parser-schema-id": "<anonymous-schema-120>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:inventory-storage:events:TransferStockAllocationRejected:v1",
                    "x-parser-schema-id": "<anonymous-schema-121>"
                  },
                  "data": {
                    "type": "object",
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
                        "x-parser-schema-id": "<anonymous-schema-123>"
                      },
                      "transfer_line_id": {
                        "type": "string",
                        "description": "Also the Kafka key and subject of the reply.",
                        "x-parser-schema-id": "<anonymous-schema-124>"
                      },
                      "origin_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-125>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-126>"
                      },
                      "requested_quantity": {
                        "type": "integer",
                        "minimum": 1,
                        "x-parser-schema-id": "<anonymous-schema-127>"
                      },
                      "reason": {
                        "type": "string",
                        "enum": [
                          "ORIGIN_SITE_UNKNOWN",
                          "INSUFFICIENT_USABLE",
                          "IDEMPOTENCY_CONFLICT"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-128>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-119>"
              }
            ],
            "x-parser-schema-id": "TransferStockAllocationRejectedEvent"
          },
          "x-parser-unique-object-id": "transferStockAllocationRejected"
        },
        "transferReceiptStaged": {
          "name": "TransferReceiptStaged",
          "title": "Transfer receipt staged",
          "summary": "inventory-storage staged a transfer receipt at the destination (consumed fact).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of inventory-storage's TransferReceiptStaged destination fact (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wms.inventory-storage.stock.TransferReceiptStaged",
                    "x-parser-schema-id": "<anonymous-schema-130>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:inventory-storage:events:TransferReceiptStaged:v1",
                    "x-parser-schema-id": "<anonymous-schema-131>"
                  },
                  "data": {
                    "type": "object",
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
                        "x-parser-schema-id": "<anonymous-schema-133>"
                      },
                      "transfer_line_id": {
                        "type": "string",
                        "description": "Also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-134>"
                      },
                      "destination_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-135>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-136>"
                      },
                      "expected_quantity": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-137>"
                      },
                      "received_quantity": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-138>"
                      },
                      "variance": {
                        "type": "integer",
                        "description": "Informational in v1 (no variance disposition workflow yet).",
                        "x-parser-schema-id": "<anonymous-schema-139>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-132>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-129>"
              }
            ],
            "x-parser-schema-id": "TransferReceiptStagedEvent"
          },
          "x-parser-unique-object-id": "transferReceiptStaged"
        },
        "transferStockStowed": {
          "name": "TransferStockStowed",
          "title": "Transfer stock stowed",
          "summary": "inventory-storage stowed transferred stock at the destination (consumed fact).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of inventory-storage's TransferStockStowed destination fact (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wms.inventory-storage.stock.TransferStockStowed",
                    "x-parser-schema-id": "<anonymous-schema-141>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:inventory-storage:events:TransferStockStowed:v1",
                    "x-parser-schema-id": "<anonymous-schema-142>"
                  },
                  "data": {
                    "type": "object",
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
                        "x-parser-schema-id": "<anonymous-schema-144>"
                      },
                      "transfer_line_id": {
                        "type": "string",
                        "description": "Also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-145>"
                      },
                      "destination_site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-146>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-147>"
                      },
                      "received_quantity": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-148>"
                      },
                      "stowed_quantity": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-149>"
                      },
                      "allocations": {
                        "type": "array",
                        "minItems": 1,
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
                              "x-parser-schema-id": "<anonymous-schema-152>"
                            },
                            "bin_id": {
                              "type": "string",
                              "x-parser-schema-id": "<anonymous-schema-153>"
                            },
                            "quantity": {
                              "type": "integer",
                              "minimum": 1,
                              "x-parser-schema-id": "<anonymous-schema-154>"
                            }
                          },
                          "x-parser-schema-id": "<anonymous-schema-151>"
                        },
                        "x-parser-schema-id": "<anonymous-schema-150>"
                      }
                    },
                    "x-parser-schema-id": "<anonymous-schema-143>"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-140>"
              }
            ],
            "x-parser-schema-id": "TransferStockStowedEvent"
          },
          "x-parser-unique-object-id": "transferStockStowed"
        }
      },
      "x-parser-unique-object-id": "warehouse.inventory.events"
    },
    "warehouse.fulfillment.events": {
      "address": "warehouse.fulfillment.events",
      "title": "fulfillment-execution integration topic",
      "description": "fulfillment-execution's integration stream. network-inventory-\nplanning consumes only the three transfer facts and ignores every\nother type.\n",
      "messages": {
        "transferPicked": {
          "name": "TransferPicked",
          "title": "Transfer picked",
          "summary": "fulfillment-execution completed a TRANSFER_PICK task (consumed fact).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of fulfillment-execution's TransferPicked fact (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferPicked",
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:fulfillment-execution:events:TransferPicked:v1",
                    "x-parser-schema-id": "<anonymous-schema-157>"
                  },
                  "data": {
                    "description": "The payload every fulfillment-execution transfer fact carries,\nmirrored read-only from fulfillment-execution's\nTransferFactData. The optional fields are omitted when the\nrelease carried none.\n",
                    "type": "object",
                    "required": [
                      "transfer_ref",
                      "work_unit_id",
                      "task_id",
                      "work_kind"
                    ],
                    "properties": {
                      "transfer_ref": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-158>"
                      },
                      "demand_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-159>"
                      },
                      "work_unit_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-160>"
                      },
                      "task_id": {
                        "type": "string",
                        "description": "Also the Kafka key and subject.",
                        "x-parser-schema-id": "<anonymous-schema-161>"
                      },
                      "work_kind": {
                        "type": "string",
                        "enum": [
                          "TRANSFER_PICK",
                          "TRANSFER_DISPATCH",
                          "TRANSFER_ARRIVAL"
                        ],
                        "x-parser-schema-id": "<anonymous-schema-162>"
                      },
                      "site_id": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-163>"
                      },
                      "sku": {
                        "type": "string",
                        "x-parser-schema-id": "<anonymous-schema-164>"
                      },
                      "quantity": {
                        "type": "integer",
                        "x-parser-schema-id": "<anonymous-schema-165>"
                      }
                    },
                    "x-parser-schema-id": "TransferFactData"
                  }
                },
                "x-parser-schema-id": "<anonymous-schema-155>"
              }
            ],
            "x-parser-schema-id": "TransferPickedEvent"
          },
          "x-parser-unique-object-id": "transferPicked"
        },
        "transferDispatched": {
          "name": "TransferDispatched",
          "title": "Transfer dispatched",
          "summary": "fulfillment-execution completed a TRANSFER_DISPATCH task (consumed fact).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of fulfillment-execution's TransferDispatched fact (consumed).",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferDispatched",
                    "x-parser-schema-id": "<anonymous-schema-167>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:fulfillment-execution:events:TransferDispatched:v1",
                    "x-parser-schema-id": "<anonymous-schema-168>"
                  },
                  "data": "$ref:$.channels.warehouse.fulfillment.events.messages.transferPicked.payload.allOf[1].properties.data"
                },
                "x-parser-schema-id": "<anonymous-schema-166>"
              }
            ],
            "x-parser-schema-id": "TransferDispatchedEvent"
          },
          "x-parser-unique-object-id": "transferDispatched"
        },
        "transferArrived": {
          "name": "TransferArrived",
          "title": "Transfer arrived",
          "summary": "fulfillment-execution completed a TRANSFER_ARRIVAL task (consumed fact, reserved).",
          "contentType": "application/cloudevents+json",
          "payload": {
            "description": "CloudEvents 1.0 envelope of fulfillment-execution's\nTransferArrived fact (consumed, RESERVED — scan-driven receiving\nmay bypass it; TransferReceiptStaged drives the same transition).\n",
            "allOf": [
              "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
              {
                "type": "object",
                "properties": {
                  "type": {
                    "const": "com.warehouse.wes.fulfillment-execution.transfer.TransferArrived",
                    "x-parser-schema-id": "<anonymous-schema-170>"
                  },
                  "dataschema": {
                    "const": "urn:warehouse:fulfillment-execution:events:TransferArrived:v1",
                    "x-parser-schema-id": "<anonymous-schema-171>"
                  },
                  "data": "$ref:$.channels.warehouse.fulfillment.events.messages.transferPicked.payload.allOf[1].properties.data"
                },
                "x-parser-schema-id": "<anonymous-schema-169>"
              }
            ],
            "x-parser-schema-id": "TransferArrivedEvent"
          },
          "x-parser-unique-object-id": "transferArrived"
        }
      },
      "x-parser-unique-object-id": "warehouse.fulfillment.events"
    }
  },
  "operations": {
    "receiveSiteCapabilityChanged": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.facility.events",
      "summary": "Keep the local site_capability read model current.",
      "description": "Consume facility-layout's SiteCapabilityChanged, dedupe on CloudEvents\nid inside the read-model transaction, and upsert site_capability keyed\nby site_id with last-writer-wins on capability_revision.\n",
      "x-parser-unique-object-id": "receiveSiteCapabilityChanged"
    },
    "receiveSiteSkuDemandChanged": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.order-management.events",
      "summary": "Keep the local site_sku_demand read model current.",
      "description": "Consume order-management's SiteSkuDemandChanged, dedupe on CloudEvents\nid inside the read-model transaction, and upsert/tombstone\nsite_sku_demand keyed by source_order_id+line_no (ACTIVE/REMOVED).\n",
      "x-parser-unique-object-id": "receiveSiteSkuDemandChanged"
    },
    "receiveCapacityPlanPublished": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.warehouse-planning.events",
      "summary": "Keep the local published_capacity_plan read model current.",
      "description": "Consume warehouse-planning's CapacityPlanPublished, dedupe on\nCloudEvents id inside the read-model transaction, and upsert\npublished_capacity_plan keyed by plan_id with last-writer-wins on the\nCloudEvents time. Legacy payloads without site_id are excluded, never\ninferred.\n",
      "x-parser-unique-object-id": "receiveCapacityPlanPublished"
    },
    "sendTransferPlanApproved": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.events",
      "summary": "Announce an operator-approved transfer plan.",
      "description": "Published through the transactional outbox in the same transaction\nthat persists the saga's APPROVED transition (POST\n/v1/transfers:approve). Subject and Kafka key are the transfer id.\n",
      "x-parser-unique-object-id": "sendTransferPlanApproved"
    },
    "sendTransferAllocationRequested": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.events",
      "summary": "Command inventory-storage to allocate origin stock.",
      "description": "The saga's COMMAND event, published right after TransferPlanApproved\nthrough the same outbox transaction (the APPROVED → ALLOCATING\ntransition). Subject and Kafka key are the transfer_line_id\n(\"<transfer_id>:1\" in v1's single-line saga) — inventory-storage's\ntransfer_allocations ledger key, so its reply and any replay\ncorrelate on exactly it.\n",
      "x-parser-unique-object-id": "sendTransferAllocationRequested"
    },
    "receiveTransferStockAllocated": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.inventory.events",
      "summary": "Drive the saga ALLOCATING → ALLOCATED.",
      "description": "inventory-storage's success reply. The consumer dedupes on the\nCloudEvents id, validates the reply against the transfer (line,\norigin, SKU, quantity sum, reservation completeness) and, in ONE\ntransaction with the processed-event claim, persists state ALLOCATED\nwith reservation_id, allocations[] and expires_at. Consumer group\nTRANSFER_REPLY_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferStockAllocated"
    },
    "receiveTransferStockAllocationRejected": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.inventory.events",
      "summary": "Drive the saga ALLOCATING → UNFULFILLABLE.",
      "description": "inventory-storage's rejection reply with one of the closed reasons\nORIGIN_SITE_UNKNOWN|INSUFFICIENT_USABLE|IDEMPOTENCY_CONFLICT. The\nconsumer applies it in ONE transaction with the processed-event\nclaim; an unknown reason is a deterministic skip. Consumer group\nTRANSFER_REPLY_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferStockAllocationRejected"
    },
    "sendWorkDemandReleased": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.events",
      "summary": "Release one transfer leg as warehouse work.",
      "description": "The WorkDemandReleased COMMAND (ADR 0005), published through the\ntransactional outbox in the SAME transaction as the state change\nthat justifies it: the ALLOCATED transition releases the pick leg\n(demand_id `<transfer_id>:pick`, quantity = allocated), the PICKED\ntransition releases the dispatch leg (demand_id\n`<transfer_id>:dispatch`, quantity = PICKED, so a short pick\ndispatches only what was picked). Subject and Kafka key are the\ndemand_id. WES validates path_id against its PathCatalogue and\nenqueues one work unit under the deterministic demand_id.\n",
      "x-parser-unique-object-id": "sendWorkDemandReleased"
    },
    "sendTransferStateAdvanced": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.analytics",
      "summary": "Announce one saga state transition for health analytics.",
      "description": "Published through the transactional outbox in the SAME transaction\nas the transition it describes (ADR 0007): data {transfer_id, from,\nto, age_seconds}, subject/key transfer_id. An occurrence exists for\nevery step of every transfer.\n",
      "x-parser-unique-object-id": "sendTransferStateAdvanced"
    },
    "sendTransferStuckDetected": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.analytics",
      "summary": "Announce a non-terminal transfer aged past its per-state threshold.",
      "description": "Emitted by a bounded in-process ticker (NIP_HEALTH_CHECK_INTERVAL,\ndefault 5m, 0=off) using per-state thresholds from\nNIP_STUCK_THRESHOLDS (defaults ALLOCATING=1h, PICKED=24h,\nIN_TRANSIT=72h, flat 24h otherwise). OBSERVE-ONLY: the check reads\nand publishes, it never mutates saga state. Data {transfer_id,\nstate, age_seconds, threshold_seconds}, subject/key transfer_id.\n",
      "x-parser-unique-object-id": "sendTransferStuckDetected"
    },
    "sendRebalanceRunCompleted": {
      "action": "send",
      "channel": "$ref:$.channels.warehouse.network-inventory-planning.analytics",
      "summary": "Announce one scheduled rebalance pass (observe-only).",
      "description": "One occurrence per NIP_REBALANCE_SCHEDULE tick (no default: unset\nmeans the loop is off). The pass runs the same fail-closed snapshot\nbuild + planner as the simulation and records a rebalance_runs row\n(served by GET /v1/rebalance-runs); it NEVER approves anything and\nNEVER emits an allocation command. Data {run_id, proposal_count,\nrejected_count, stale_facts}, subject/key run_id.\n",
      "x-parser-unique-object-id": "sendRebalanceRunCompleted"
    },
    "receiveTransferPicked": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.fulfillment.events",
      "summary": "Drive the saga ALLOCATED → PICKED and release the dispatch leg.",
      "description": "fulfillment-execution's pick-completion fact. The consumer applies\nit in ONE transaction with the processed-event claim: PICKED state,\npicked_quantity recorded (a SHORT pick is recorded, not refused),\nand the dispatch WorkDemandReleased outboxed with the picked\nquantity. A fact whose transfer_ref names no known transfer is\nWARN-logged and committed past. Consumer group\nTRANSFER_FACT_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferPicked"
    },
    "receiveTransferDispatched": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.fulfillment.events",
      "summary": "Drive the saga PICKED → IN_TRANSIT.",
      "description": "fulfillment-execution's dispatch-completion fact. No demand is\nreleased (the arrival leg is triggered by the receiving scan).\nConsumer group TRANSFER_FACT_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferDispatched"
    },
    "receiveTransferArrived": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.fulfillment.events",
      "summary": "Drive the saga IN_TRANSIT → ARRIVED (reserved kind).",
      "description": "fulfillment-execution's arrival-completion fact. RESERVED:\nscan-driven receiving may bypass it entirely —\ninventory-storage's TransferReceiptStaged drives the same\ntransition, and whichever arrives first wins (the other is a\ndeterministic out-of-order skip). Consumer group\nTRANSFER_FACT_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferArrived"
    },
    "receiveTransferReceiptStaged": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.inventory.events",
      "summary": "Drive the saga IN_TRANSIT → ARRIVED (scan-driven receiving).",
      "description": "inventory-storage's destination receipt fact: the received stock\nwas staged at the destination. Same transition as the reserved\nTransferArrived fact. The variance is informational. Consumer\ngroup TRANSFER_REPLY_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferReceiptStaged"
    },
    "receiveTransferStockStowed": {
      "action": "receive",
      "channel": "$ref:$.channels.warehouse.inventory.events",
      "summary": "Drive the saga ARRIVED → RECEIVED (terminal).",
      "description": "inventory-storage's destination stow fact: the received stock was\nstowed into destination bins. RECEIVED is terminal; the stow\nallocations are persisted on the aggregate. Consumer group\nTRANSFER_REPLY_CONSUMER_GROUP (env-configured).\n",
      "x-parser-unique-object-id": "receiveTransferStockStowed"
    }
  },
  "components": {
    "messages": {
      "siteCapabilityChanged": "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged",
      "siteSkuDemandChanged": "$ref:$.channels.warehouse.order-management.events.messages.siteSkuDemandChanged",
      "capacityPlanPublished": "$ref:$.channels.warehouse.warehouse-planning.events.messages.capacityPlanPublished",
      "transferPlanApproved": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.transferPlanApproved",
      "transferAllocationRequested": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.transferAllocationRequested",
      "transferStockAllocated": "$ref:$.channels.warehouse.inventory.events.messages.transferStockAllocated",
      "transferStockAllocationRejected": "$ref:$.channels.warehouse.inventory.events.messages.transferStockAllocationRejected",
      "workDemandReleased": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.workDemandReleased",
      "transferPicked": "$ref:$.channels.warehouse.fulfillment.events.messages.transferPicked",
      "transferDispatched": "$ref:$.channels.warehouse.fulfillment.events.messages.transferDispatched",
      "transferArrived": "$ref:$.channels.warehouse.fulfillment.events.messages.transferArrived",
      "transferReceiptStaged": "$ref:$.channels.warehouse.inventory.events.messages.transferReceiptStaged",
      "transferStockStowed": "$ref:$.channels.warehouse.inventory.events.messages.transferStockStowed",
      "transferStateAdvanced": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.transferStateAdvanced",
      "transferStuckDetected": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.transferStuckDetected",
      "rebalanceRunCompleted": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.rebalanceRunCompleted"
    },
    "schemas": {
      "cloudEvent": "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload.allOf[0]",
      "SiteCapabilityChangedEvent": "$ref:$.channels.warehouse.facility.events.messages.siteCapabilityChanged.payload",
      "SiteSkuDemandChangedEvent": "$ref:$.channels.warehouse.order-management.events.messages.siteSkuDemandChanged.payload",
      "CapacityPlanPublishedEvent": "$ref:$.channels.warehouse.warehouse-planning.events.messages.capacityPlanPublished.payload",
      "TransferPlanApprovedEvent": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.transferPlanApproved.payload",
      "TransferAllocationRequestedEvent": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.transferAllocationRequested.payload",
      "TransferStockAllocatedEvent": "$ref:$.channels.warehouse.inventory.events.messages.transferStockAllocated.payload",
      "TransferStockAllocationRejectedEvent": "$ref:$.channels.warehouse.inventory.events.messages.transferStockAllocationRejected.payload",
      "WorkDemandReleasedEvent": "$ref:$.channels.warehouse.network-inventory-planning.events.messages.workDemandReleased.payload",
      "TransferFactData": "$ref:$.channels.warehouse.fulfillment.events.messages.transferPicked.payload.allOf[1].properties.data",
      "TransferPickedEvent": "$ref:$.channels.warehouse.fulfillment.events.messages.transferPicked.payload",
      "TransferDispatchedEvent": "$ref:$.channels.warehouse.fulfillment.events.messages.transferDispatched.payload",
      "TransferArrivedEvent": "$ref:$.channels.warehouse.fulfillment.events.messages.transferArrived.payload",
      "TransferReceiptStagedEvent": "$ref:$.channels.warehouse.inventory.events.messages.transferReceiptStaged.payload",
      "TransferStockStowedEvent": "$ref:$.channels.warehouse.inventory.events.messages.transferStockStowed.payload",
      "TransferStateAdvancedEvent": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.transferStateAdvanced.payload",
      "TransferStuckDetectedEvent": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.transferStuckDetected.payload",
      "RebalanceRunCompletedEvent": "$ref:$.channels.warehouse.network-inventory-planning.analytics.messages.rebalanceRunCompleted.payload"
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
  