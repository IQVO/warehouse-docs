---
id: sequence-diagrams
title: Sequence Diagrams
sidebar_label: Sequence Diagrams
description: Proposed UML sequence diagrams for every Node Topology command use case, from the HTTP adapter through the aggregate, repository and outbox to Kafka.
---

# Sequence Diagrams

:::info[As built]
Derived from [`model/model.yaml`](https://github.com/IQVO/retail-network-docs/blob/main/model/model.yaml). This context's service is built; the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses.
:::

One UML sequence diagram per command use case of the **proposed** service.
The participants are the same in every diagram:

| Participant | Proposed package |
| --- | --- |
| http adapter | `internal/adapters/inbound/http` |
| use case | `internal/application/usecases` |
| aggregate | `internal/domain/node`, `lane`, `servicearea` or `region` |
| Repositories | `internal/adapters/outbound/postgres` behind `internal/application/ports` |
| Postgres tx | the same transaction as the save: `outbox_events` and `idempotency_keys` |
| relay to Kafka | `internal/adapters/outbound/kafka`, publishing to `retailnetwork.node-topology.events` |

Every diagram shows the `Idempotency-Key` check, the optimistic-concurrency
version check (or the unique index that replaces it on a create), the outbox
write in the same transaction, and the relay. A domain error writes nothing
and publishes nothing. The problem `type` slugs match
[Use Cases](/network/contexts/node-topology/use-cases). Path parameters are written
without braces in the diagrams.

## 1. RegisterNode

`POST /nodes`, published type `com.retailnetwork.logistics.node-topology.node.NodeRegistered`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Node
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID regionId
        alt region not defined
            UC-->>H: 422 unknown-region
        end
        UC->>A: Register type, subtype, operator, vendorRef, region
        alt operator not allowed for the type
            A-->>UC: ErrOperatorNotAllowedForNodeType
            UC-->>H: 422 operator-not-allowed-for-node-type
        else subtype not of the node type
            A-->>UC: ErrSubtypeNotAllowed
            UC-->>H: 422 subtype-not-allowed
        else vendor node
            UC->>R: FindByVendorNodeCode
            alt code already used by this vendor
                R-->>UC: existing node
                UC-->>H: 409 vendor-node-code-taken
            end
        end
        Note over A: capabilities from DefaultCapabilitiesByType, state PROPOSED
        UC->>R: Insert node, unique vendor code
        alt unique vendor_id, vendor_node_code hit
            R-->>UC: duplicate
            UC-->>H: 409 vendor-node-code-taken
        else saved
            UC->>TX: insert outbox row NodeRegistered
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 201 node
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish NodeRegistered
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]` (`commands`, `invariants`), `.rest`, `.publishes[NodeRegistered]`; `conventions.integration_rules`.

Omitted: a new node has no version to check, so the unique constraint on `(vendor_id, vendor_node_code)` takes that role and catches two concurrent registrations. A network node has no vendor reference and skips the lookup. The `Region` is read, never saved.

## 2. DeclareOperationalProfile

`PUT /nodes/{nodeId}/operational-profile`, published type `com.retailnetwork.logistics.node-topology.node.NodeOperationalProfileDeclared`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Node
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID nodeId
        alt unknown node
            UC-->>H: 404 not-found
        end
        UC->>A: DeclareOperationalProfile p
        alt node RETIRED
            A-->>UC: ErrNodeRetired
            UC-->>H: 409 node-retired
        else revision not above current
            A-->>UC: ErrStaleProfileRevision
            UC-->>H: 409 stale-profile-revision
        else a cutoff on a day outside that day's hours
            A-->>UC: ErrCutoffOutsideOperatingHours
            UC-->>H: 422 cutoff-outside-operating-hours
        else sort dwell on a node that is not a sort centre or air hub
            A-->>UC: ErrSortDwellNotAllowed
            UC-->>H: 422 sort-dwell-not-allowed
        else ACTIVE FC revision without cutoff or handling time
            A-->>UC: ErrIncompleteOperationalProfile
            UC-->>H: 409 incomplete-operational-profile
        end
        Note over A: new revision appended, old ones untouched
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row NodeOperationalProfileDeclared
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 node and profile
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish NodeOperationalProfileDeclared
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]` (`commands`, `invariants`), `.rest`, `.publishes[NodeOperationalProfileDeclared]`; `conventions.integration_rules`.

Omitted: a node with no profile yet takes any first revision above zero. Both `vendor-connectivity` (`declaredBy` `VENDOR`) and the network-ops planner (`declaredBy` `NETWORK_OPS`) call this route.

## 3. ActivateNode

`POST /nodes/{nodeId}:activate`, published type `com.retailnetwork.logistics.node-topology.node.NodeActivated`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Node
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID nodeId
        UC->>A: Activate now
        alt node RETIRED
            A-->>UC: ErrNodeRetired
            UC-->>H: 409 node-retired
        else FULFILLMENT_CENTER without cutoff or handling time
            A-->>UC: ErrIncompleteOperationalProfile
            UC-->>H: 409 incomplete-operational-profile
        else already ACTIVE
            A-->>UC: ErrIllegalTransition
            UC-->>H: 409 illegal-transition
        end
        Note over A: PROPOSED or SUSPENDED to ACTIVE
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row NodeActivated
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 node
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish NodeActivated
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]` (`commands`, `invariants`), `.rest`, `.publishes[NodeActivated]`; `conventions.integration_rules`.

Omitted: the 404 for an unknown `nodeId` (same as diagram 2).

## 4. SuspendNode

`POST /nodes/{nodeId}:suspend`, published type `com.retailnetwork.logistics.node-topology.node.NodeSuspended`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Node
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID nodeId
        UC->>A: Suspend reason, now
        alt node RETIRED
            A-->>UC: ErrNodeRetired
            UC-->>H: 409 node-retired
        else not ACTIVE
            A-->>UC: ErrIllegalTransition
            UC-->>H: 409 illegal-transition
        end
        Note over A: ACTIVE to SUSPENDED
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row NodeSuspended
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 node
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish NodeSuspended
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]` (`commands`, `invariants`), `.rest`, `.publishes[NodeSuspended]`; `conventions.integration_rules`.

Omitted: the 404 for an unknown `nodeId`; the downstream reactions (on [Domain Message Flow](/network/contexts/node-topology/domain-message-flow)).

## 5. RetireNode

`POST /nodes/{nodeId}:retire`, published type `com.retailnetwork.logistics.node-topology.node.NodeRetired`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Node
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID nodeId
        UC->>A: Retire now
        alt node already RETIRED
            A-->>UC: ErrNodeRetired
            UC-->>H: 409 node-retired
        else still PROPOSED
            A-->>UC: ErrIllegalTransition
            UC-->>H: 409 illegal-transition
        end
        Note over A: ACTIVE or SUSPENDED to RETIRED, terminal
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row NodeRetired
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 node
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish NodeRetired
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Node]` (`commands`, `invariants`), `.rest`, `.publishes[NodeRetired]`; `conventions.integration_rules`.

Omitted: the 404 for an unknown `nodeId`. The node's lanes and service areas are not touched (policy `SuspendedEndpointsUnusable`).

## 6. OpenLane

`POST /lanes`, published type `com.retailnetwork.logistics.node-topology.lane.LaneOpened`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Lane
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        alt origin equals destination
            UC-->>H: 422 lane-loop
        end
        UC->>R: FindByID origin and destination nodes
        alt type pair not in lane_rules
            UC-->>H: 422 lane-type-pair-not-allowed
        else an end not ACTIVE
            UC-->>H: 409 lane-endpoint-not-active
        end
        UC->>A: Open origin, destination, mode, transit
        Note over A: state OPEN
        UC->>R: Insert lane
        alt partial unique index uq_lanes_open hit
            R-->>UC: duplicate
            UC-->>H: 409 duplicate-lane
        else saved
            UC->>TX: insert outbox row LaneOpened
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 201 lane
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish LaneOpened
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane]` (`commands`, `invariants`), `.rest`, `.publishes[LaneOpened]`; `conventions.integration_rules`.

Omitted: the 404 when a named node is unknown. `ErrLaneLoop` and `ErrLaneTypePairNotAllowed` are raised by the `Lane` constructor; the diagram shows them before it for brevity. The two `Node` aggregates are read, never saved.

## 7. CloseLane

`POST /lanes/{laneId}:close`, published type `com.retailnetwork.logistics.node-topology.lane.LaneClosed`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Lane
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByID laneId
        alt unknown lane
            UC-->>H: 404 not-found
        end
        UC->>A: Close now
        alt already CLOSED
            A-->>UC: ErrIllegalTransition
            UC-->>H: 409 illegal-transition
        end
        Note over A: OPEN to CLOSED
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row LaneClosed
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 lane
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish LaneClosed
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Lane]` (`commands`, `invariants`), `.rest`, `.publishes[LaneClosed]`; `conventions.integration_rules`.

Omitted: nothing else; `CloseLane` touches no other aggregate.

## 8. AssignServiceArea

`PUT /service-areas/{postalPrefix}`, published type `com.retailnetwork.logistics.node-topology.servicearea.ServiceAreaAssigned`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as ServiceArea
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByPrefix, or start new
        UC->>R: FindByID station node and its region
        alt not an ACTIVE DELIVERY_STATION
            UC-->>H: 409 not-a-delivery-station
        else station's region not defined
            UC-->>H: 422 unknown-region
        end
        UC->>A: Assign station, version
        alt version not above current
            A-->>UC: ErrStaleAssignmentVersion
            UC-->>H: 409 stale-assignment-version
        end
        Note over A: ASSIGNED to ASSIGNED, regionId from the station, history row added
        UC->>R: Save with version check
        alt version changed since load
            R-->>UC: conflict
            Note over UC: reload and retry once, then 409 concurrent-update
        else saved
            UC->>TX: insert outbox row ServiceAreaAssigned
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 200 service area
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish ServiceAreaAssigned
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[ServiceArea]` (`commands`, `invariants`), `.rest`, `.publishes[ServiceAreaAssigned]`; `conventions.integration_rules`.

Omitted: the 404 for an unknown station `nodeId`. The station `Node` and its `Region` are read, never saved.

## 9. DefineRegion

`POST /regions`, published type `com.retailnetwork.logistics.node-topology.region.RegionDefined`.

```mermaid
%%{init: {"sequence": {"wrap": true, "width": 120, "actorMargin": 24, "messageMargin": 28, "boxMargin": 6, "noteMargin": 6, "mirrorActors": false}}}%%
sequenceDiagram
    autonumber
    participant H as http adapter
    participant UC as use case
    participant A as Region
    participant R as Repositories
    participant TX as Postgres tx<br/>outbox + idem keys
    participant K as relay to Kafka
    H->>TX: find Idempotency-Key
    alt key seen with the same request
        TX-->>H: stored response
        H-->>H: replay it, nothing runs
    else new key
        H->>UC: Execute
        UC->>R: FindByCode code
        alt code taken
            UC-->>H: 409 region-code-taken
        end
        UC->>A: Define code, name
        UC->>R: Insert region
        alt unique index on code hit
            R-->>UC: duplicate
            UC-->>H: 409 region-code-taken
        else saved
            UC->>TX: insert outbox row RegionDefined
            UC->>TX: insert idempotency record
            TX-->>UC: commit
            UC-->>H: 201 region
        end
    end
    K->>TX: claim unpublished rows
    K->>K: publish RegionDefined
    K->>TX: mark published
```

Derived from: model.yaml → `contexts[node-topology].aggregates[Region]` (`commands`, `invariants`), `.rest`, `.publishes[RegionDefined]`; `conventions.integration_rules`.

Omitted: nothing else.
