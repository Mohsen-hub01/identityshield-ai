
import argparse
import asyncio
import json
import time
import traceback
import unicodedata

from contextlib import redirect_stdout
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

from identityshield_mcp.agent import MODEL, run_agent


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

SCENARIOS_PATH = (
    BASE_DIR
    / "scripts"
    / "evaluation"
    / "agent_scenarios.json"
)

REPORT_PATH = (
    BASE_DIR
    / "scripts"
    / "evaluation"
    / "reports"
    / "latest_evaluation.json"
)


# ============================================================
# UTILITIES
# ============================================================

def normalize(text: str) -> str:
    """Normalize text for robust, accent-insensitive checks."""
    return "".join(
        char
        for char in unicodedata.normalize(
            "NFKD",
            str(text),
        ).casefold()
        if not unicodedata.combining(char)
    )


def get_tool_result(execution: dict, tool_name: str):
    """Retrieve the result of a specific MCP tool."""
    for item in execution.get("tool_results", []):
        if item.get("tool") == tool_name:
            return item

    return None


def unwrap_result(item):
    """Unwrap nested MCP structured results safely."""
    if item is None:
        return {}

    result = item.get("result", {})

    # MCP may wrap structured results inside one or more
    # nested "result" keys.
    while (
        isinstance(result, dict)
        and isinstance(result.get("result"), dict)
    ):
        result = result["result"]

    return result if isinstance(result, dict) else {}


def add_check(
    checks: list,
    name: str,
    passed: bool,
    expected,
    actual,
):
    """Add one evaluation check."""
    checks.append({
        "name": name,
        "passed": bool(passed),
        "expected": expected,
        "actual": actual,
    })


# ============================================================
# SCENARIO EVALUATION
# ============================================================

def evaluate_execution(
    scenario: dict,
    execution: dict,
) -> list[dict]:
    """Evaluate an agent execution against one reference scenario."""

    expected = scenario["expected"]
    checks = []

    trace = execution.get("tool_trace", [])

    attempted_tools = {
        item.get("name")
        for item in trace
    }

    # --------------------------------------------------------
    # 1. Agent completion
    # --------------------------------------------------------

    add_check(
        checks,
        "Agent completed",
        execution.get("status") == "completed",
        "completed",
        execution.get("status"),
    )

    # --------------------------------------------------------
    # 2. Required tools
    # --------------------------------------------------------

    for tool in expected.get("required_tools", []):
        add_check(
            checks,
            f"Required tool: {tool}",
            tool in attempted_tools,
            "called",
            tool in attempted_tools,
        )

    # --------------------------------------------------------
    # 3. Forbidden tools
    # --------------------------------------------------------

    for tool in expected.get("forbidden_tools", []):
        add_check(
            checks,
            f"Forbidden tool: {tool}",
            tool not in attempted_tools,
            "not called",
            "called" if tool in attempted_tools else "not called",
        )

    report = execution.get("final_report") or ""
    normalized_report = normalize(report)

    # --------------------------------------------------------
    # 4. Risk analysis scenarios
    # --------------------------------------------------------

    if "risk_score" in expected or "risk_level" in expected:

        item = get_tool_result(
            execution,
            "analyze_access_event",
        )

        payload = unwrap_result(item)

        result_is_valid = (
            item is not None
            and not item.get("is_error", True)
            and payload.get("error") is not True
        )

        add_check(
            checks,
            "Analysis returned successfully",
            result_is_valid,
            "successful MCP analysis",
            "error or missing result" if not result_is_valid else "success",
        )

        # Rule-based risk score
        if "risk_score" in expected:
            actual = payload.get("risk_score")

            add_check(
                checks,
                "Rule-based risk score",
                (
                    result_is_valid
                    and actual == expected["risk_score"]
                ),
                expected["risk_score"],
                actual,
            )

        # Risk level
        if "risk_level" in expected:
            actual = payload.get("risk_level")

            add_check(
                checks,
                "Risk level",
                (
                    result_is_valid
                    and actual == expected["risk_level"]
                ),
                expected["risk_level"],
                actual,
            )

        # Workflow status
        if "status" in expected:
            actual = payload.get("status")

            add_check(
                checks,
                "Workflow status",
                (
                    result_is_valid
                    and actual == expected["status"]
                ),
                expected["status"],
                actual,
            )

    # --------------------------------------------------------
    # 5. SC04 - Unknown user
    # --------------------------------------------------------

    if expected.get("outcome") == "controlled_error":

        item = get_tool_result(
            execution,
            "analyze_access_event",
        )

        payload = unwrap_result(item)

        error_text = normalize(
            json.dumps(
                payload,
                ensure_ascii=False,
                default=str,
            )
        )

        # The error can be returned either as:
        # - a native MCP error
        # - a structured business error
        error_detected = (
            item is not None
            and (
                item.get("is_error") is True
                or payload.get("error") is True
            )
        )

        # Prefer the explicit error code.
        # Also support the descriptive message.
        message_present = (
            payload.get("code") == "PROFILE_NOT_FOUND"
            or "profil synthetique introuvable" in error_text
        )

        add_check(
            checks,
            "Unknown profile handled as an error",
            error_detected and message_present,
            "controlled unknown-profile error",
            payload if item else "No analysis result",
        )

        # Verify that no profile was fabricated.
        fabricated_profile = any(
            unwrap_result(result).get("profile") not in (None, {})
            for result in execution.get("tool_results", [])
        )

        add_check(
            checks,
            "No fabricated profile",
            not fabricated_profile,
            "no profile fabricated",
            "profile fabricated" if fabricated_profile else "none",
        )

    # --------------------------------------------------------
    # 6. SC05 - Missing information
    # --------------------------------------------------------

    if expected.get("outcome") == "ask_clarification":

        keywords = [
            "heure",
            "precis",
            "precision",
            "manqu",
            "quelle",
            "information",
        ]

        asks_for_information = any(
            keyword in normalized_report
            for keyword in keywords
        )

        add_check(
            checks,
            "Agent requests missing information",
            bool(report) and asks_for_information,
            f"Ask for: {expected['missing_field']}",
            report[:500] if report else "No final report",
        )

    # --------------------------------------------------------
    # 7. RAG playbook source
    # --------------------------------------------------------

    if "expected_source" in expected:

        rag_item = get_tool_result(
            execution,
            "search_security_playbook",
        )

        rag_payload = unwrap_result(rag_item)

        sources = [
            match.get("source", "")
            for match in rag_payload.get("matches", [])
            if isinstance(match, dict)
        ]

        source_found = any(
            expected["expected_source"].casefold() in source.casefold()
            for source in sources
        )

        add_check(
            checks,
            "Expected playbook source retrieved",
            source_found,
            expected["expected_source"],
            sources,
        )

    return checks


# ============================================================
# RUN ONE SCENARIO
# ============================================================

async def evaluate_scenario(scenario: dict) -> dict:
    """Run and evaluate one scenario."""

    started = time.perf_counter()
    captured_stdout = StringIO()

    try:

        with redirect_stdout(captured_stdout):
            execution = await run_agent(scenario["prompt"])

        checks = evaluate_execution(
            scenario,
            execution,
        )

        return {
            "scenario_id": scenario["id"],
            "scenario_name": scenario["name"],
            "status": (
                "PASS"
                if all(check["passed"] for check in checks)
                else "FAIL"
            ),
            "duration_seconds": round(
                time.perf_counter() - started,
                2,
            ),
            "passed_checks": sum(
                check["passed"]
                for check in checks
            ),
            "total_checks": len(checks),
            "checks": checks,
            "tools_called": execution.get("tools_called", []),
            "tool_trace": execution.get("tool_trace", []),
            "tool_results": execution.get("tool_results", []),
            "final_report": execution.get("final_report"),
            "agent_stdout": captured_stdout.getvalue(),
            "error": None,
            "error_traceback": None,
        }

    except Exception as exc:

        return {
            "scenario_id": scenario["id"],
            "scenario_name": scenario["name"],
            "status": "ERROR",
            "duration_seconds": round(
                time.perf_counter() - started,
                2,
            ),
            "passed_checks": 0,
            "total_checks": 0,
            "checks": [],
            "tools_called": [],
            "tool_trace": [],
            "tool_results": [],
            "final_report": None,
            "agent_stdout": captured_stdout.getvalue(),
            "error": f"{type(exc).__name__}: {exc}",
            "error_traceback": "".join(
                traceback.format_exception(exc)
            ),
        }


# ============================================================
# MAIN EVALUATION
# ============================================================

async def main():

    parser = argparse.ArgumentParser(
        description=(
            "Evaluate IdentityShield AI Copilot "
            "against reference scenarios."
        )
    )

    parser.add_argument(
        "--scenario",
        help=(
            "Run one scenario, for example SC01. "
            "Default: run all scenarios."
        ),
    )

    args = parser.parse_args()

    # Load evaluation scenarios
    data = json.loads(
        SCENARIOS_PATH.read_text(
            encoding="utf-8-sig",
        )
    )

    scenarios = data["scenarios"]

    # Optional scenario selection
    if args.scenario:

        scenarios = [
            item
            for item in scenarios
            if item["id"].upper() == args.scenario.upper()
        ]

        if not scenarios:
            raise SystemExit(
                f"Scenario not found: {args.scenario}"
            )

    print(
        f"Evaluation: {data['evaluation_name']}"
    )

    print(f"Model: {MODEL}")
    print(f"Scenarios selected: {len(scenarios)}")

    print(
        "OpenRouter usage: live API calls may incur charges."
    )

    results = []

    # --------------------------------------------------------
    # Execute selected scenarios
    # --------------------------------------------------------

    for scenario in scenarios:

        print(
            f"\nRunning {scenario['id']} - "
            f"{scenario['name']}..."
        )

        result = await evaluate_scenario(scenario)

        results.append(result)

        print(
            f"{result['status']} | "
            f"{result['passed_checks']}/"
            f"{result['total_checks']} checks | "
            f"{result['duration_seconds']}s"
        )

        for check in result["checks"]:

            mark = (
                "PASS"
                if check["passed"]
                else "FAIL"
            )

            print(
                f"  {mark}: {check['name']}"
            )

        if result["error"]:

            print(
                "  ERROR:",
                result["error"],
            )

            print(
                result.get("error_traceback")
                or "No traceback captured."
            )

            if result.get("agent_stdout"):
                print(result["agent_stdout"])

    # --------------------------------------------------------
    # Aggregate evaluation metrics
    # --------------------------------------------------------

    passed_scenarios = sum(
        result["status"] == "PASS"
        for result in results
    )

    total_checks = sum(
        result["total_checks"]
        for result in results
    )

    passed_checks = sum(
        result["passed_checks"]
        for result in results
    )

    scenario_success_rate = (
        round(
            passed_scenarios / len(results) * 100,
            2,
        )
        if results
        else 0
    )

    check_success_rate = (
        round(
            passed_checks / total_checks * 100,
            2,
        )
        if total_checks
        else 0
    )

    # --------------------------------------------------------
    # Build final report
    # --------------------------------------------------------

    report = {
        "evaluation_name": data["evaluation_name"],
        "evaluated_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "model": MODEL,
        "scenario_count": len(results),
        "passed_scenarios": passed_scenarios,
        "failed_scenarios": (
            len(results) - passed_scenarios
        ),
        "scenario_success_rate": scenario_success_rate,
        "passed_checks": passed_checks,
        "total_checks": total_checks,
        "check_success_rate": check_success_rate,
        "results": results,
    }

    # Save report
    REPORT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    REPORT_PATH.write_text(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
            default=str,
        ) + "\n",
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Display final summary
    # --------------------------------------------------------

    print("\n=== EVALUATION SUMMARY ===")

    print(
        f"Scenarios passed: "
        f"{passed_scenarios}/{len(results)}"
    )

    print(
        "Scenario success rate:",
        f"{scenario_success_rate}%",
    )

    print(
        f"Checks passed: "
        f"{passed_checks}/{total_checks}"
    )

    print(
        "Check success rate:",
        f"{check_success_rate}%",
    )

    print(
        f"Report saved to: {REPORT_PATH}"
    )


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    asyncio.run(main())
