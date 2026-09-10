# Compliance Review (Technical Posture)

Checked: 2026-09-10. NOTHING HERE IS LEGAL ADVICE OR A COMPLIANCE CLAIM.
Professional legal review is REQUIRED before production launch.

## Nigeria (primary market signals in the directive)
- NDPA (Nigeria Data Protection Act 2023): lawful basis, notice, data
  subject rights, breach notification, DPO considerations. The product
  implements the technical bones: consent records, minimisation, retention
  sweeps, export/delete endpoints, breach alerts. Registration with NDPC
  and any filings: NOT DONE; requires the operator's legal process.
- FCCPC / consumer protection: clear pricing, refund and cancellation
  terms exist as pages; pricing is deliberately unset until economics are
  real; subscription terms must be honest before charging anyone.
- Copyright: user uploads must warrant rights; takedown process exists;
  repeat infringer policy documented in the AUP.

## Cross-border
- Serving users outside Nigeria imports GDPR-like duties (EU/UK), state
  laws (US), and others. The architecture supports purpose limitation and
  deletion; the legal analysis is operator work before launch.

## Payments compliance
- Flutterwave selected. PCI scope sits with the PSP when using hosted
  checkout; webhook signature verification is implemented at the interface
  level and must be enabled with real credentials. No live charges now.

## AI/voice specific
- Voice cloning of real persons without consent is a tort and, in several
  jurisdictions, increasingly statutory territory. The platform's consent
  and moderation gates are the technical mitigations; policy text states
  the rules; enforcement is human review, which is staffed by the operator.

## Open compliance items (tracked, not hidden)
1. NDPC registration and NDPA gap review (professional).
2. Kaggle ToS review before serving third-party traffic via notebooks.
3. PSP contract review (Flutterwave) before enabling live charges.
4. Accessibility audit (WCAG AA) on real users and assistive tech.
5. Formal security audit (external) before public launch.
