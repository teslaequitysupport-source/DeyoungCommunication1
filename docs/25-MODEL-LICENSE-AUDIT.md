# Model License Audit

Checked: 2026-09-10. THIS IS THE CRITICAL AUDIT FOR A VOICE PRODUCT.

## Engine candidates
| Engine | Code | Weights/base models | Real-time | Decision |
|---|---|---|---|---|
| RVC (Retrieval-based-Voice-Conversion-WebUI) | MIT | base pretrained permissive per annotated-RVC; .pth on the hub varies | yes, proven | PRIMARY when runtime installed |
| Applio | MIT | same RVC weight caveats | yes | acceptable alternative trainer/UI |
| w-okada VCClient | MIT | n/a (client) | yes | reference implementation |
| Seed-VC | GPL-3.0 | its checkpoints inherit GPL terms | yes (~400 ms) | EXCLUDED from default pipeline; would require GPL-compliant isolation and legal review |
| DDSP-SVC | MIT-family (verify at integration) | per checkpoint | partial | future candidate |
| Beatrice | custom/nonstandard claims | per release | yes | UNVERIFIED; not integrated |

## System models shipped
- Three SYSTEM_DSP presets using the platform DSP engine. They are
  parameter sets, not trained models: no third-party weights, no dataset
  encumbrance, no voice rights issues. This is why the free tier can run
  everywhere with zero license risk.

## Third-party .pth voice models
- DEFAULT STATUS: UNKNOWN rights. A voice model may encode a real person's
  voice; using it without that person's permission risks publicity-rights,
  privacy and contract violations regardless of code licenses.
- Platform enforcement: uploads require a signed rights declaration and
  consent records; moderation review approves each model; takedown exists;
  public-figure impersonation is rejected; abuse reports are tracked.

## Before enabling RVC in production
1. Pin and record the RVC repo commit; archive its LICENSE.
2. Record the origin and license of every bundled base checkpoint.
3. Require per-model license metadata on every user upload (mandatory
   fields), plus the rights declaration; reject without it.
4. Legal review for SaaS use in target jurisdictions (required, not done).
