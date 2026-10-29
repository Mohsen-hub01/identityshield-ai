# Repeated Failed Login Investigation

## Purpose
Guide the review of repeated authentication failures that may indicate
password guessing, credential stuffing, or a legitimate user mistake.

## Relevant signals
- Repeated failed authentication attempts.
- Failures concentrated in a short time window.
- Attempts involving multiple accounts or unfamiliar sources.
- A successful login following many failures.
- Other signals such as an unfamiliar device or elevated IP risk.

## Investigation procedure
1. Establish the number and timing of failed attempts.
2. Determine whether the attempts concern one account or several.
3. Check for a subsequent successful authentication.
4. Correlate available source, device, and session information.
5. Look for independent risk indicators.
6. Record evidence supporting both suspicious and legitimate explanations.

## Recommended handling
Escalate when repeated failures are supported by additional suspicious
signals or an unusual successful login.

Consider ordinary explanations such as a mistyped password or an expired
credential. Avoid treating one threshold breach as conclusive evidence
of an attack.

Any account restriction or session revocation must follow the relevant
organization policy and authorization process.

## Evidence to record
- Number and timestamps of failed attempts.
- Whether a successful login followed.
- Available source and device information.
- Related alerts and corroborating signals.
- Investigation outcome and reviewer rationale.
