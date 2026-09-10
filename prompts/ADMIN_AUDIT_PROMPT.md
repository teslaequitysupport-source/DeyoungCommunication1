# Admin Audit Prompt

Verify the /admin command centre: every panel shows server data with
loading, error and empty states; every mutation is audited with actor,
target, before/after; destructive actions require confirmation; the audit
chain verifier passes on a fresh chain and fails on a tampered copy; RBAC
blocks non-admins on every /api/admin route (try it); the test lab only
touches TEST scope. Report gaps with evidence from actual requests.
