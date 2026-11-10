---
paths:
  - "docs/**"
  - "network/docs/**"
  - "storefront/docs/**"
  - "yard/docs/**"
  - "src/**"
  - "**/*.mdx"
---

# Docusaurus and MDX pitfalls

Moved verbatim from this repo's CLAUDE.md (now a short map). Paths in another repo are written
as words, not backticked: guide-lint resolves every backticked path in THIS repo.

## Docusaurus pitfall: relative links break under a custom `slug`

A page with `slug: /some-path` in its frontmatter resolves relative
markdown links (`./sibling`) relative to the FOLDER path, not the slug,
even though the page renders at the slug URL. Symptom: `Docusaurus found
broken links!` naming one index page, even when several deeper pages have
the same issue and would break too if reached another way. Fix: any page
with a custom `slug` must use absolute site-rooted links
(`/strategic-design/domain-vision`), never relative ones. Pages WITHOUT a
custom `slug` can keep relative links safely.

Other MDX traps: `{` and `<` in prose break MDX (wrap in backticks);
admonition titles are `:::note[Title]`, never `:::note Title`; Mermaid
diagrams that render client-side are NOT checked by `docusaurus build` —
run `npm run validate:mermaid`.
