# Audit follow-up: environment-validation

Priority: Low

Status: planned; implementation has not started.

Location: `src/server.ts and src/database/pool.ts`

## Finding

PORT and DATABASE_POOL_SIZE are converted with Number without explicit validation. Invalid values can produce obscure startup errors, request failures, or an unintended port or pool configuration.

## Acceptance criteria

- [ ] Validate PORT as an integer from 1 through 65535 and DATABASE_POOL_SIZE as a positive integer.
- [ ] Reject empty, nonnumeric, fractional, negative, and out-of-range values with clear configuration errors.
- [ ] Retain documented defaults when variables are absent.
- [ ] Use the same pool-size validation for URL and Cloud SQL socket connections.
- [ ] Add focused configuration tests and keep README/environment descriptions consistent.

## Scope

This document records future work only. This PR does not implement the fix or change application behavior. Reverify the finding against the current code before starting implementation.
