---
id: use-cases
title: Use Cases
sidebar_label: Use Cases
description: Every proposed Product Content command use case with its actor or trigger, inbound adapter, preconditions, main flow, error mapping, events and idempotency.
---

# Use Cases

:::info[Proposed design]
Derived from [`model/model.yaml`](https://github.com/IQVO/warehouse-docs/blob/main/storefront/model/model.yaml). Nothing in this context is built; the model carries the proposed contracts, and identifiers (`Err...` names, routes, CloudEvents types) are the names a future implementation must use.
:::

One section per command of `contexts[product-content].aggregates[*].commands`.
They are proposed application services in `internal/application/usecases`. The
step-by-step diagrams are on [Sequence Diagrams](/storefront/contexts/product-content/sequence-diagrams);
the payloads are on [Domain Events](/storefront/contexts/product-content/domain-events);
the proposed REST contract is `apis/product-content/openapi.yaml`.

Reads are not use cases here: `GET /product-contents` (paged, for
`product-discovery`'s bootstrap), `GET /product-contents/{catalogItemId}`
and `GET /categories` read the stores directly. The projection of
`CatalogItemCreated` and `CatalogItemDiscontinued` into `CatalogItemView` is
not a use case either: it is the projector behind the
`ErrUnknownCatalogItem` check. (`CatalogItemDiscontinued` additionally
triggers the `RetireOnDiscontinue` policy, which is a use case below.)

## Triggers at a glance

| Use case | Trigger | Inbound adapter | Emits |
| --- | --- | --- | --- |
| `CreateProductContent` | Content manager | REST `POST /product-contents` | none |
| `ReviseContent` | Content manager | REST `POST /product-contents/{catalogItemId}:revise` | none (re-publication is a model gap) |
| `PublishContent` | Content manager | REST `POST /product-contents/{catalogItemId}:publish` | `ProductContentPublished` |
| `RetireContent` | Content manager | REST `POST /product-contents/{catalogItemId}:retire` | `ProductContentRetired` |
| `RetireContent` (policy) | `RetireOnDiscontinue` | Kafka consumer, `CatalogItemDiscontinued` | `ProductContentRetired` |
| `CreateCategory` | Content manager | REST `POST /categories` | none |
| `MoveCategory` | Content manager | REST `POST /categories/{categoryId}:move` | none |
| `RenameCategory` | Content manager | REST `POST /categories/{categoryId}:rename` | none |
| `PublishCategoryTree` | not named in the model | none (no `inbound` row, no route) | `CategoryTreePublished` |

## How save and publish commit

Every use case that changes an aggregate loads it with its `version`, calls
the aggregate, then saves it inside one Postgres transaction. The save is
conditional on the version it loaded (`UPDATE ... WHERE version = ?`). If an
event is raised, the outbox row (`outbox_events`) is written in the same
transaction. A consumer-driven use case also inserts the CloudEvents `id`
into `processed_events` in that transaction. A relay publishes outbox rows
to Kafka after the commit. This context makes no synchronous calls
(`sync_calls` is empty), so no use case waits on another context.

Error responses use `application/problem+json` (RFC 9457) with `type`
`/problems/<slug>` (a relative URI reference). Shared slugs
(`conventions.integration_rules`): not-found 404, illegal-transition 409,
concurrent-update 409, validation-failed 422, plus one kebab-case slug per
`Err` below. Every write route takes an `Idempotency-Key` header; a repeated
key returns the stored response of the first call.

## CreateProductContent

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /product-contents`, header
  `Idempotency-Key` required; body `catalogItemId`, `description`,
  `bullets[]`, `attributes[]`, `media[]`, `primaryCategoryId`.
- **Preconditions:** the item exists in `CatalogItemView`; the content does
  not exist yet.
- **Main flow:**
  1. Look up the `Idempotency-Key`. On a hit with the same request body,
     return the stored response.
  2. Check the `catalogItemId` against `CatalogItemView`
     (`ErrUnknownCatalogItem`).
  3. Check `primaryCategoryId` against the current tree
     (`ErrUnknownCategory`).
  4. `ProductContent.CreateProductContent(...)`: state `DRAFT`. This pack's
     reading: the full content arrives in one call, because the model has
     no `DRAFT → DRAFT` transition to edit a draft with.
  5. In one transaction, insert the content and store the response under
     the `Idempotency-Key`.
  6. Answer `201` with the content.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrUnknownCatalogItem` | 422 | `unknown-catalog-item` | The item is not in `CatalogItemView`: never created, or the projection lags. |
| `ErrUnknownCategory` | 422 | `unknown-category` | The `primaryCategoryId` is not in the current tree. |
| validation | 422 | `validation-failed` | Schema rules, including the collection bounds (bullets at most 10, attributes at most 50, media at most 12), which have no `Err` names. |
| duplicate content for the item | 409 | `concurrent-update` | The proposed API maps a second create to 409; the model names no `Err` for it. |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`; the primary key on `catalogItemId` is
  the last guard.
- **Risk:** the model does not say whether a **discontinued** item passes
  `ErrUnknownCatalogItem` (unlike `pricing`'s rule, the invariant checks
  existence only). Content for a discontinued item may be created until the
  model says otherwise.

## ReviseContent

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /product-contents/{catalogItemId}:revise`,
  header `Idempotency-Key` required; same body as create.
- **Preconditions:** the content exists and is PUBLISHED (the only source
  state of the modelled transition); the named category exists.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load `ProductContent` with its `version` (404 if absent).
  3. `ReviseContent(...)`: replaces description, bullets, attributes, media
     and primary category; state stays PUBLISHED. It checks
     `ErrContentRetired` and `ErrUnknownCategory`.
  4. Save (version checked) and store the key response in one transaction.
  5. Answer `200` with the revised content.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| content not found | 404 | `not-found` | No content for the item. |
| `ErrContentRetired` | 409 | `content-retired` | RETIRED content never changes again. |
| `ErrUnknownCategory` | 422 | `unknown-category` | The new primary category is not in the current tree. |
| validation | 422 | `validation-failed` | Schema rules and collection bounds. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case before it is returned. |

- **Events emitted:** none modelled. How a revised PUBLISHED content reaches
  `product-discovery` is a model gap: `PublishContent` is `DRAFT →
  PUBLISHED` only, so no transition re-publishes, yet the proposed API says
  the revision bumps "once published again" and `product-discovery` orders
  content by `revision`.
- **Idempotency:** `Idempotency-Key`.

## PublishContent

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /product-contents/{catalogItemId}:publish`,
  header `Idempotency-Key` required.
- **Preconditions:** the content exists and is DRAFT; the publish gate
  passes.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load `ProductContent` with its `version` (404 if absent).
  3. `PublishContent(...)`: checks `ErrContentRetired`, `ErrUnknownCategory`
     and the publish gate `ErrIncompleteContent` (a description, exactly one
     PRIMARY medium and a category). State PUBLISHED, revision bumped.
  4. In one transaction, save (version checked), write
     `ProductContentPublished` to the outbox, store the key response.
  5. Answer `200` with the published content.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| content not found | 404 | `not-found` | No content for the item. |
| `ErrIncompleteContent` | 422 | `incomplete-content` | Missing description, not exactly one PRIMARY medium, or no category. |
| `ErrUnknownCategory` | 422 | `unknown-category` | The primary category left the current tree. |
| `ErrContentRetired` | 409 | `content-retired` | RETIRED never publishes again. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** `ProductContentPublished` with the full content and
  the new `revision`.
- **Idempotency:** `Idempotency-Key`; a repeated publish of the same
  revision is a no-op because the state is already PUBLISHED (the transition
  no longer applies from PUBLISHED — the model has no
  `PUBLISHED → PUBLISHED` publish, which is the re-publication gap).

## RetireContent (content manager)

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /product-contents/{catalogItemId}:retire`,
  header `Idempotency-Key` required.
- **Preconditions:** the content exists and is PUBLISHED.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load `ProductContent` with its `version` (404 if absent).
  3. `RetireContent(...)`: state RETIRED (terminal).
  4. In one transaction, save (version checked), write
     `ProductContentRetired` to the outbox, store the key response.
  5. Answer `200` with the retired content.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| content not found | 404 | `not-found` | No content for the item. |
| illegal transition | 409 | `illegal-transition` | The content is DRAFT (no `DRAFT → RETIRED` transition) or already RETIRED. |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** `ProductContentRetired`.
- **Idempotency:** `Idempotency-Key`; retiring a RETIRED content is the
  409 above, not a no-op.

## RetireContent (policy RetireOnDiscontinue)

- **Actor / trigger:** `offer-availability` discontinued the item.
- **Inbound adapter:** Kafka consumer on
  `retailnetwork.offer-availability.events`, type
  `com.retailnetwork.commerce.offer-availability.catalogitem.CatalogItemDiscontinued`.
- **Preconditions:** the item has PUBLISHED content. A DRAFT is left alone;
  the model does not say what happens to it (model gap).
- **Main flow:**
  1. Inbox check on the CloudEvents `id`; a duplicate is acknowledged.
  2. Mark the item discontinued in `CatalogItemView`.
  3. Load the item's `ProductContent`. If none or not PUBLISHED, stop.
  4. `RetireContent(...)`: state RETIRED.
  5. Save, outbox `ProductContentRetired`, inbox row, one transaction.
- **Errors:** none expected: the policy only touches PUBLISHED content, so
  `illegal-transition` cannot fire. An anomaly is logged and acknowledged.
- **Events emitted:** `ProductContentRetired`.
- **Idempotency:** inbox on the CloudEvents `id`; the state check makes a
  replayed effect a no-op.

## CreateCategory

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /categories`, header `Idempotency-Key`
  required; body `parentId` (optional), `name`.
- **Preconditions:** the parent exists in the working tree; the structural
  invariants hold after the insert.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load the `CategoryTree` with its `version`.
  3. `CreateCategory(parentId, name)`: checks `ErrMaxDepth` (the tree is at
     most four levels deep), `ErrCategoryCycle` and
     `ErrDuplicateSiblingName`; computes the new node's `path`.
  4. Save (version checked) and store the key response in one transaction.
  5. Answer `201` with the category.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| `ErrMaxDepth` | 422 | `max-depth` | The new node would sit below level four. |
| `ErrCategoryCycle` | 422 | `category-cycle` | The proposed API lists it on create; a brand-new node cannot close a cycle, so this can only fire on a parent that is itself inconsistent. |
| `ErrDuplicateSiblingName` | 422 | `duplicate-sibling-name` | A sibling already has this name. |
| validation | 422 | `validation-failed` | An empty name or a missing parent id shape. |

- **Events emitted:** none; the tree reaches `product-discovery` only at
  publication.
- **Idempotency:** `Idempotency-Key`.

## MoveCategory

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /categories/{categoryId}:move`, header
  `Idempotency-Key` required; body `parentId` (nullable: move to the root).
- **Preconditions:** the category and the new parent exist; the structural
  invariants hold after the move.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load the `CategoryTree` (404 if the category is unknown).
  3. `MoveCategory(categoryId, parentId)`: checks `ErrCategoryCycle` (a node
     never moves under its own subtree), `ErrMaxDepth` and
     `ErrDuplicateSiblingName`; recomputes the `path` of the moved subtree.
  4. Save (version checked) and store the key response.
  5. Answer `200` with the moved category.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| category not found | 404 | `not-found` | Unknown `categoryId` or `parentId`. |
| `ErrCategoryCycle` | 422 | `category-cycle` | The new parent is inside the moved subtree. |
| `ErrMaxDepth` | 422 | `max-depth` | The moved subtree would reach below level four. |
| `ErrDuplicateSiblingName` | 422 | `duplicate-sibling-name` | The new siblings already have this name. |
| `ErrCategoryInUse` | 409 | `category-in-use` | The proposed API maps it to `:move`, although the invariant guards **removal** and the model has no remove command (model gap). |
| version conflict | 409 | `concurrent-update` | Retried once inside the use case. |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`.

## RenameCategory

- **Actor / trigger:** the storefront content manager.
- **Inbound adapter:** REST `POST /categories/{categoryId}:rename`, header
  `Idempotency-Key` required; body `name`.
- **Preconditions:** the category exists; no sibling has the new name.
- **Main flow:**
  1. Look up the `Idempotency-Key`; replay on a hit.
  2. Load the `CategoryTree` (404 if the category is unknown).
  3. `RenameCategory(categoryId, name)`: checks
     `ErrDuplicateSiblingName`; the `path` segments depending on the name
     are recomputed.
  4. Save (version checked) and store the key response.
  5. Answer `200` with the renamed category.
- **Errors:**

| Error | HTTP | Problem `type` slug | Note |
| --- | --- | --- | --- |
| category not found | 404 | `not-found` | Unknown `categoryId`. |
| `ErrDuplicateSiblingName` | 422 | `duplicate-sibling-name` | A sibling already has this name. |
| validation | 422 | `validation-failed` | An empty name. |

- **Events emitted:** none.
- **Idempotency:** `Idempotency-Key`.

## PublishCategoryTree

- **Actor / trigger:** **not named in the model**: no `inbound` row carries
  the command and no route in `rest` publishes the tree (model gap). These
  pages read it as a deliberate content-manager action whose route the model
  has not named yet.
- **Inbound adapter:** unknown; drawn as a content-manager action.
- **Preconditions:** the working tree differs from the last publication
  (otherwise the publication is a no-op with a bumped `version`; the model
  allows `PUBLISHED → PUBLISHED`).
- **Main flow:**
  1. Load the `CategoryTree` with its optimistic-concurrency guard.
  2. `PublishCategoryTree(...)`: state PUBLISHED, tree `version` bumped.
  3. In one transaction, save and write `CategoryTreePublished` (the whole
     tree under the new `version`) to the outbox.
  4. Answer with the published tree.
- **Errors:** none named in the model. The structural invariants hold for
  the working tree at all times, so publication needs no re-check.
- **Events emitted:** `CategoryTreePublished`.
- **Idempotency:** the trigger is unknown, so no `Idempotency-Key` handling
  is specified; the event's `version` is the consumer's guard.
