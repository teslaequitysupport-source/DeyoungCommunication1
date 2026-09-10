# Audit Prompt

Audit the VOXCORE codebase against docs/04-REQUIREMENTS.md. For every
requirement: find the implementation, run the proof (script, test lab
kind, or API call), and classify DONE, PARTIAL, or NOT BUILT with
evidence. List every placeholder, mock, or fabricated value in production
surfaces. Output: a traceability table and a punch list ordered by
severity. Do not fix anything during the audit; report only.
