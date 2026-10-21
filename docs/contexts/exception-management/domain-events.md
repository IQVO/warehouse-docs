---
id: domain-events
title: Domain events
sidebar_label: Domain events
description: Every event exception-management publishes or consumes — seven published types on warehouse.exception-management.events (+analytics) through the transactional outbox, and eleven consumed fact types from six sibling contexts.
---

# Domain events

Every event this context publishes or consumes, with the full CloudEvents
`type`. The contract is
[`apis/asyncapi.yaml`](https://github.com/IQVO/exception-management/blob/develop/apis/asyncapi.yaml);
the envelope (`specversion` 1.0, `id`, `source`
`/warehouse/exception-management`, `type`, `subject`, `time`,
`datacontenttype` `application/json`, `dataschema`) is built only by
`internal/adapters/kafka/cloudevents`. Payload fields are snake_case and
timestamps are RFC 3339 UTC.

## Published

`dataschema` is
`urn:warehouse:exception-management:<events|analytics>:<EventName>:v1` —
unlike returns-processing, the analytics mirror IS built: both topics carry
the same `type` and the same CloudEvents `id` per occurrence, and the
analytics stream is this service's own projector only, not an integration
contract. The Kafka key = the subject (the case id; the source type for the
policy event), so one case's history stays ordered on one partition.

| Event | Full type | Subject / key | Raised by |
| --- | --- | --- | --- |
| ExceptionOpened | `com.warehouse.wes.exception-management.exceptioncase.ExceptionOpened` | caseId | `OpenOrTouchException`, first occurrence of the dedup key |
| ExceptionTriaged | `com.warehouse.wes.exception-management.exceptioncase.ExceptionTriaged` | caseId | `TriageException` (REST) |
| ExceptionAssigned | `com.warehouse.wes.exception-management.exceptioncase.ExceptionAssigned` | caseId | `AssignException` (REST) |
| ExceptionEscalated | `com.warehouse.wes.exception-management.exceptioncase.ExceptionEscalated` | caseId | the SLA sweeper |
| ExceptionResolved | `com.warehouse.wes.exception-management.exceptioncase.ExceptionResolved` | caseId | `ResolveException` (REST, terminal) |
| ExceptionAutoResolved | `com.warehouse.wes.exception-management.exceptioncase.ExceptionAutoResolved` | caseId | `AutoResolveOnCorrelation` (a policy rule on a correlated fact) |
| ExceptionPolicyDeclared | `com.warehouse.wes.exception-management.exceptionpolicy.ExceptionPolicyDeclared` | sourceType | `DeclareExceptionPolicy` (REST `PUT /exception-policies/{sourceType}`) |

### Payloads

| Event | `data` fields |
| --- | --- |
| ExceptionOpened | `case_id`, `source_type`, `source_subject`, `site_id` (nullable), `severity`, `queue`, `opened_at`, `sla_due_at`, `source_event_id`, `source_payload` (object, frozen) |
| ExceptionTriaged | `case_id`, `severity`, `queue`, `actor`, `at` |
| ExceptionAssigned | `case_id`, `assignee`, `actor`, `at` |
| ExceptionEscalated | `case_id`, `sla_due_at`, `at` |
| ExceptionResolved | `case_id`, `resolution_code`, `root_cause`, `note` (nullable), `actor`, `at` |
| ExceptionAutoResolved | `case_id`, `rule_id` (`<sourceType>-><onType>`), `correlated_type`, `correlated_event_id`, `at` |
| ExceptionPolicyDeclared | `source_type`, `version`, `severity`, `queue`, `sla_minutes`, `auto_resolve:{on_type, within_minutes}` (nullable) |

Golden files pin the exact bytes of every type
(`internal/adapters/outbound/kafka/testdata/*.golden.json`). No consumer of
these events exists yet in any repository: `labor-performance` may read
`ExceptionResolved` later (named by ADR 0001, not built).

## Consumed

The consumed messages are the producers' own contracts, restated in this
context's AsyncAPI and never imported. Each opens or touches exactly one open
case per dedup key; the CloudEvents `id` claim and the effect commit in one
transaction, and the offset is committed only afterwards. Group ids come from
six mandatory env vars.

| Full type | Topic | Group env var | Effect |
| --- | --- | --- | --- |
| `com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed` | `warehouse.fulfillment.events` | `FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP` | open/touch; re-fires on every sweep tick by design (occurrence + 1); the `order_ref` work unit is the auto-resolve key |
| `com.warehouse.wes.fulfillment-execution.package.PackageDiverted` | `warehouse.fulfillment.events` | same | open/touch (promoted on the producer's integration topic 2026-10-21) |
| `com.warehouse.wes.fulfillment-execution.package.WeightDiscrepancyDetected` | `warehouse.fulfillment.events` | same | open/touch (promoted 2026-10-21) |
| `com.warehouse.wes.work-planning.workpool.BacklogThresholdBreached` | `warehouse.work-planning.events` | `WORK_PLANNING_EXCEPTIONS_CONSUMER_GROUP` | open/touch, one case per path while the alarm keeps re-firing |
| `com.warehouse.wes.network-fulfillment.networkorder.AcknowledgementDeadlineAtRisk` | `warehouse.network-fulfillment.events` | `NETWORK_FULFILLMENT_EXCEPTIONS_CONSUMER_GROUP` | open/touch; re-fires on every sweep pass |
| `com.warehouse.wes.network-fulfillment.networkorder.OrphanedHoldCancelled` | `warehouse.network-fulfillment.events` | same | open/touch |
| `com.warehouse.wes.order-management.order.OrderRepromised` | `warehouse.order-management.events` | `ORDER_CORRELATION_CONSUMER_GROUP` | opens NO case: the correlated fact of the auto-resolve rule (order-level match on the frozen `order_ref`, inclusive window) |
| `com.warehouse.wms.returns-processing.returnreceipt.UnexpectedReturnReceived` | `warehouse.returns-processing.events` | `RETURNS_EXCEPTIONS_CONSUMER_GROUP` | open/touch, one case per receipt line |
| `com.warehouse.wms.inventory-storage.bin.DiscrepancyDetected` | `warehouse.inventory.events` | `INVENTORY_EXCEPTIONS_CONSUMER_GROUP` | open/touch (promoted 2026-10-21) |
| `com.warehouse.wms.inventory-storage.stock.ItemUnlocated` | `warehouse.inventory.events` | same | open/touch (promoted 2026-10-21) |

Planned, not built (analytics-only on their producers today, promotion
pending): workforce-management `PathUnderstaffed` and
network-inventory-planning `TransferStuckDetected`. Those edges stay dashed
planned in the fleet [Context Map](/strategic-design/context-map), never
faked.

## Example: ExceptionOpened

From the golden test file (`exception_opened.golden.json`):

```json
{
  "specversion": "1.0",
  "id": "6f1d2c3b-4a5e-4b7c-8d9e-0a1b2c3d4e5f",
  "source": "/warehouse/exception-management",
  "type": "com.warehouse.wes.exception-management.exceptioncase.ExceptionOpened",
  "subject": "case-6b1e4a2c-8d3f-4e5a-9c7b-2f1d8e4a5c63",
  "time": "2026-10-21T09:30:00Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:warehouse:exception-management:events:ExceptionOpened:v1",
  "data": {
    "case_id": "case-6b1e4a2c-8d3f-4e5a-9c7b-2f1d8e4a5c63",
    "source_type": "com.warehouse.wes.fulfillment-execution.task.TaskCPTMissed",
    "source_subject": "task-8a1f",
    "site_id": null,
    "severity": "HIGH",
    "queue": "ps-main",
    "opened_at": "2026-10-21T09:30:00Z",
    "sla_due_at": "2026-10-21T10:00:00Z",
    "source_event_id": "0e8d7c6b-5a4f-4c3b-9e2d-1f0a9b8c7d6e",
    "source_payload": {
      "cpt": "2026-09-30T14:55:00Z",
      "order_ref": "wu-8a1f",
      "task_id": "task-8a1f",
      "task_type": "PICK"
    }
  }
}
```
