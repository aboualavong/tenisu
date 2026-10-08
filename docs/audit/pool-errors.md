# Audit follow-up: pool-errors

Priority: Medium

Status: planned; implementation has not started.

Location: `src/database/pool.ts`

## Finding

The PostgreSQL pool has no error event listener. A disconnected idle client can emit an unhandled error and terminate the API process.

## Acceptance criteria

- [ ] Handle background pool errors without exposing credentials.
- [ ] Keep the process available after an idle connection error, allowing subsequent requests to reconnect.
- [ ] Add a regression test for an idle-client error and verify ordinary query failures still reach the HTTP error handler.

## Scope

This document records future work only. This PR does not implement the fix or change application behavior. Reverify the finding against the current code before starting implementation.
