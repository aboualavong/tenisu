# Audit follow-up: error-logging

Priority: Medium

Status: planned; implementation has not started.

Location: `src/http/error-handler.ts`

## Finding

Unexpected errors return a generic HTTP 500 response without an application log of the underlying failure, making production diagnosis difficult.

## Acceptance criteria

- [ ] Record useful, filtered server-side diagnostics for unexpected errors.
- [ ] Exclude API keys, credentials, request bodies, and password-bearing SQL from logs.
- [ ] Preserve the existing public error response.
- [ ] Test that unexpected errors are logged safely and secrets never appear in logs.

## Scope

This document records future work only. This PR does not implement the fix or change application behavior. Reverify the finding against the current code before starting implementation.
