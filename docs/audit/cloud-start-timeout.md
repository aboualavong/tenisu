# Audit follow-up: cloud-start-timeout

Priority: Medium

Status: planned; implementation has not started.

Location: `scripts/cloud.sh`

## Finding

The start action exits when gcloud sql instances patch exceeds its waiting deadline, even if Google Cloud continues starting the database. Cloud Run activation is then skipped. This occurred during a real startup in this session.

## Acceptance criteria

- [ ] Wait for the existing Cloud SQL operation when the CLI waiting deadline expires.
- [ ] Distinguish a waiting timeout from a genuine cloud operation failure.
- [ ] Reactivate Cloud Run only after successful database startup.
- [ ] Avoid submitting duplicate start operations and report actionable failure information.
- [ ] Test normal startup, delayed completion, failed operations, and an already-running instance.

## Scope

This document records future work only. This PR does not implement the fix or change application behavior. Reverify the finding against the current code before starting implementation.
