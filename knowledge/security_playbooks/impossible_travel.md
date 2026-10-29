# Impossible Travel Investigation

## Purpose
Provide a structured investigation procedure when access events indicate
that the same identity may have connected from geographically distant
locations within an implausibly short interval.

## Relevant signals
- An impossible-travel indicator raised by the detection system.
- A country or location that differs from the user's normal profile.
- Unusual access time.
- A new device or elevated IP-risk score.
- Multiple correlated signals in the same access session.

## Investigation procedure
1. Confirm the timestamp and the available location information.
2. Compare the event with the user's established access profile.
3. Check whether other independent risk signals are present.
4. Review relevant authentication and session records when available.
5. Assess whether the evidence is consistent with legitimate travel,
   a VPN, a proxy, or potentially unauthorized access.
6. Document the evidence and remaining uncertainty.

## Recommended handling
Escalate the case for human review when several independent indicators
support a suspicious-access hypothesis.

Do not conclude that an account is compromised from geographic distance
alone. Do not automatically block an account based solely on this playbook.

## Evidence to record
- Event identifier and timestamp.
- Observed locations and their data sources.
- Related risk indicators.
- Supporting and contradicting evidence.
- Reviewer decision and rationale.
