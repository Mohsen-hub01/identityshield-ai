# New Device Access Investigation

## Purpose
Provide guidance when an identity accesses a service from a device that
has not previously been associated with its normal activity.

## Relevant signals
- A new-device indicator.
- A new location or unusual access time.
- An elevated IP-risk score.
- Recent failed authentication attempts.
- An impossible-travel alert or other correlated indicator.

## Investigation procedure
1. Confirm how the device was classified as new.
2. Compare the event with the user's available access history.
3. Review authentication strength and available session metadata.
4. Correlate the event with location, time, and network risk.
5. Determine whether independent signals support the suspicion.
6. Record missing evidence and possible legitimate explanations.

## Recommended handling
A new device is not, by itself, proof of malicious activity.
Escalate for human review when the event is accompanied by meaningful
additional evidence.

Use only authorized investigation tools and follow the applicable
identity-verification and incident-response policies.

## Evidence to record
- Device indicator and event timestamp.
- Relevant historical comparison.
- Related risk indicators.
- Supporting and contradicting evidence.
- Final reviewer decision and rationale.
