# QA Prompt

Run the full verification: bash scripts/verify-suite.sh. Then attempt to
break it: kill the worker mid-session, drain with live traffic, stop the
gateway during a session, hammer /api/health past its limit, register a
worker without a token, start a session with an unapproved model. Record
actual outputs, expected vs observed, and file bugs with severity. Rerun
until the suite is green and every bug has a ticket in the worklog.
