# Mobile Audit Prompt

Review docs/mobile/* for claims that outrun evidence. Every capability
row must be a platform-capability statement or carry device test results
with dates. Verify the Mode A/B/C language (system mic injection is
UNSUPPORTED on iOS and without root on Android), background execution and
permission language against current OS versions, and battery/thermal
claims (none allowed without device benchmarks). Output: corrected
matrices and a list of any claim that must be softened.
