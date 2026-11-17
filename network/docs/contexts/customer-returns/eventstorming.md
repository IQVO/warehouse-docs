---
id: eventstorming
title: EventStorming
sidebar_label: EventStorming
description: "Process-level EventStorming boards for Customer Returns, from the facts it reads to a closed authorization, with hotspots for what is not built yet."
---

# EventStorming

:::info[As built]
Derived from [`network/model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/network/model/model.yaml). This context's service is built ([`IQVO/customer-returns`](https://github.com/IQVO/customer-returns), decided by [ADR 0012](/network/adr/0012-customer-returns-is-a-bounded-context)); the model carries its as-built contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names the service uses. Where the model left a choice open, the service's own ADRs 0001 to 0005 record what it does.
:::

Process-level boards in the ddd-crew
[EventStorming glossary & cheat sheet](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)
notation. Every sticky comes from `model.yaml`; every hotspot is a residual
the model states in a policy or a note. The network-wide
board is [EventStorming big picture](/network/strategic-design/eventstorming-big-picture).

| Sticky | Colour | Meaning here |
| --- | --- | --- |
| Command | blue `#a5d8ff` | `AuthorizeReturn`, `IssueLabel`, `CancelReturn`, `ApplyOutcome` |
| Aggregate | yellow `#ffec99` | `ReturnAuthorization` |
| Domain Event | orange `#ffc078` | an event published or consumed |
| Policy | lilac `#d0bfff` | a rule from `policies` |
| Read Model | green `#b2f2bb` | `OrderGroupView`, `ReturnsNetworkView`, `ReturnOutcomeFacts` |
| External System | pink `#fcc2d7` | another context or an actor |
| Hotspot | red `#ff8787` | an open question |

## 1. The facts arrive

```mermaid
flowchart TB
    CO["customer-ordering"]:::external
    NT["node-topology"]:::external
    OS["order-sourcing"]:::external
    E1["CustomerOrderPlaced"]:::event
    E2["ShopperNoticeDecided"]:::event
    E3["NodeActivated<br/>ServiceAreaAssigned"]:::event
    E4["FulfillmentLocked<br/>FulfillmentReleasedToNode"]:::event
    R1["OrderGroupView"]:::readmodel
    R2["ReturnsNetworkView"]:::readmodel
    CO --> E1 --> R1
    CO --> E2 --> R1
    NT --> E3 --> R2
    OS --> E4 --> R2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 2. Authorize and decide

```mermaid
flowchart TB
    SF["storefront"]:::external
    C1["AuthorizeReturn"]:::command
    R1["OrderGroupView"]:::readmodel
    R2["ReturnsNetworkView"]:::readmodel
    P1["Policy: DispositionDecidedAtAuthorization"]:::policy
    P2["Policy: ReturnlessKeep"]:::policy
    G1["ReturnAuthorization"]:::aggregate
    E1["ReturnAuthorized"]:::event
    H1["Hotspot: nothing stops a second<br/>authorization of the same group"]:::hotspot
    SF --> C1 --> G1 --> E1
    R1 --- C1
    R2 --- C1
    P1 --- G1
    P2 --- G1
    G1 --- H1
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 3. Label, cancel, expire

```mermaid
flowchart TB
    SF["storefront"]:::external
    C1["IssueLabel"]:::command
    P1["Policy: ReverseLabelCall"]:::policy
    P2["Policy: OneLabelPerPackage"]:::policy
    G1["ReturnAuthorization"]:::aggregate
    E1["ReturnLabelIssued"]:::event
    C2["CancelReturn"]:::command
    P3["Policy: LazyExpiry"]:::policy
    E2["ReturnCancelled"]:::event
    H1["Hotspot: the label route is not<br/>in its owner's contract yet"]:::hotspot
    H2["Hotspot: an untouched expired<br/>authorization stays AUTHORIZED"]:::hotspot
    SF --> C1 --> G1 --> E1
    P1 --- C1
    P2 --- G1
    P1 --- H1
    SF --> C2 --> G1 --> E2
    P3 --> C2
    P3 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## 4. Outcome and restock

```mermaid
flowchart TB
    V["returns centre<br/>through the vendor seam"]:::external
    P1["Policy: FirstFittingOutcomeCompletes"]:::policy
    C1["ApplyOutcome"]:::command
    G1["ReturnAuthorization"]:::aggregate
    R1["ReturnOutcomeFacts"]:::readmodel
    P2["Policy: UnexpectedLinesStayFacts"]:::policy
    E1["ReturnCompleted"]:::event
    OA["offer-availability"]:::external
    H1["Hotspot: the graded outcome is not<br/>published by its owner yet"]:::hotspot
    H2["Hotspot: nothing sets IN_TRANSIT<br/>or PICKUP_FAILED"]:::hotspot
    V --> P1 --> C1 --> G1 --> E1 --> OA
    P1 --> R1
    P2 --- R1
    V --- H1
    G1 --- H2
    classDef command fill:#a5d8ff,stroke:#1971c2,color:#000
    classDef aggregate fill:#ffec99,stroke:#e67700,color:#000
    classDef event fill:#ffc078,stroke:#d9480f,color:#000
    classDef policy fill:#d0bfff,stroke:#6741d9,color:#000
    classDef readmodel fill:#b2f2bb,stroke:#2f9e44,color:#000
    classDef external fill:#fcc2d7,stroke:#c2255c,color:#000
    classDef hotspot fill:#ff8787,stroke:#c92a2a,color:#000
```

## Hotspots

| Hotspot | Where it comes from |
| --- | --- |
| Nothing stops a second authorization of the same group | Aggregate note: two authorizations of one group are distinct aggregates (service ADR 0002 A3) |
| The label route is not in its owner's contract yet | Policy `ReverseLabelCall`: decided in `shipping-and-tracking` ADR 0017, not in its OpenAPI on `develop` |
| An untouched expired authorization stays `AUTHORIZED` | Policy `LazyExpiry`: there is no sweeper (service ADR 0002 A4) |
| The graded outcome is not published by its owner yet | Policy `FirstFittingOutcomeCompletes`: decided in `vendor-connectivity` ADR 0014, not in its contracts on `develop` |
| Nothing sets `IN_TRANSIT` or `PICKUP_FAILED` | Aggregate note: `MarkInTransit` and `MarkPickupFailed` have no caller; policy `PickupIsRecordedNotRun` |
