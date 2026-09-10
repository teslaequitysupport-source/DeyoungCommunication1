# Admin Site Customization

Checked: 2026-09-10.

## Scope
- SiteSetting keys: brand name, tagline, hero copy, feature list, theme
  tokens (radius, spacing, accent), navigation visibility, announcement
  banner, legal page content overrides, SEO metadata.
- Workflow: DRAFT -> PREVIEW (private render) -> APPROVE -> PUBLISH.
- SettingVersion rows keep every published version; rollback reinstates a
  version atomically; change log visible in the panel.

## Guardrails
- Schema-validated values only; no arbitrary HTML injection into pages
  (rich text is restricted to a safe subset); CSP unaffected.
- Dangerous changes (e.g., disabling auth-required surfaces) are feature
  flags with confirmations, not settings typos.
