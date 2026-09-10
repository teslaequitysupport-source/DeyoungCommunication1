# Compliance Audit Prompt

Check docs/26-COMPLIANCE.md open items and the legal pages against actual
product behaviour: does the privacy policy match the real data inventory
(no trackers, no audio persistence), do the refund/cancellation pages
match billing reality (no live charges), are consent records actually
created on model upload, does takedown actually remove a model from
every catalog, is the dev-mode verification token affordance gated to
EMAIL_MODE=none. Output: page-by-page findings; mark anything requiring
professional legal review; do not claim compliance.
