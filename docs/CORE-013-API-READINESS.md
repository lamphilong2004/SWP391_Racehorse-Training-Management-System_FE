# CORE-013 registration API readiness

This follow-up starts from accepted FE Integration `6e8361c`. It changes only the Pedigree & Ownership error/retry behavior and focused tests. It does not promote Integration history into dev, redesign Figma, or complete backend activation.

The approved screen remains SCR-HORSE-004, Figma `283:2487`. CORE-013 is Long's scope in `project-context/Racehorse_Core_Flow_Execution.xlsx`; the workbook still records To Do and is not updated by this delivery. CORE-002/004 prerequisites are already integrated. DEC-009 requires automatic activation and a non-blocking Head Trainer acknowledgement. No manual activation action is added.

## Partial API availability

The form first reads the real horse identity. A denied or missing identity stays an error. Owner accounts, assignment history and the activation checklist are read independently using the existing canonical API client. Failed reads do not select fixtures, imply an empty history, or imply that a Vet baseline has not been recorded.

When supporting reads fail, the verified horse and form remain visible. The affected values say unavailable, and Save is disabled in both the button and submit handler. The Club Manager can inspect real Stable Box data, retry setup reads, or return to the saved profile/register. Retry preserves all edits, including fields deliberately cleared. A successful retry restores the existing contracted pedigree/ownership submit path.

## Verification and remaining ownership

Focused HTTP fixtures cover each failed supporting resource, no mutation while unavailable, input preservation, validation and exact pedigree/ownership payloads after retry. These fixtures are not SQL integration evidence. Existing accepted real Create/List/Detail evidence is retained separately and is not rerun without related changes.

Remaining APIs belong to Dũng and the assigned activation/baseline owners: ownership and Owner-picker support, pedigree, stable assignment/history, pending/activation status, readiness acknowledgement and Vet baseline. The API adapter already uses the approved operations; unavailable endpoints remain real errors. Full DRAFT to ACTIVE verification and the full CORE-013 visual/Independent Gate remain pending those deliveries. CORE-033 `324d511` is unchanged.
