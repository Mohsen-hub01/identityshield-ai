
import asyncio
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from dotenv import load_dotenv
from mcp import Client, StdioServerParameters
from openai import AsyncOpenAI


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

MODEL = os.getenv(
    "IDENTITYSHIELD_LLM_MODEL",
    "openai/gpt-4o-mini",
)

MAX_TOOL_ROUNDS = 4

# L'agent ne dispose que d'outils de lecture et d'analyse.
# La décision de revue humaine reste réservée à un humain.
ALLOWED_TOOLS = {
    "search_security_playbook",
    "get_user_profile",
    "analyze_access_event",
}


SYSTEM_PROMPT = """
Tu es IdentityShield AI Copilot, un assistant d'investigation
en sécurité des identités.

Réponds en français et fonde tes conclusions sur les résultats
réellement retournés par les outils MCP.

Structure chaque rapport ainsi :

1. VERDICT
   - Identifiant utilisateur
   - Score des règles et niveau de risque
   - Prédiction ML, probabilité suspecte et seuil de décision
   - Action recommandée par le workflow

2. SIGNAUX EXPLICATIFS
   - Principaux facteurs SHAP positifs et négatifs
   - Explication concise de leur effet
   - Différences éventuelles entre les règles et le ML

3. PROCÉDURE DE SÉCURITÉ
   - Recommandations issues du playbook
   - Source et section des passages utilisés

4. LIMITES ET PROCHAINE ACTION
   - Éléments de preuve disponibles et manquants
   - Incertitudes de l'analyse
   - Nécessité d'une revue humaine lorsque le workflow l'exige

Règles impératives :
- N'invente jamais de scores, de preuves, de sources ou d'actions.
- Si un outil n'a pas été appelé, ne prétends pas avoir utilisé ses résultats.
- Ne présente jamais une probabilité comme une certitude.
- Les valeurs SHAP ne sont pas des pourcentages de probabilité.
- Distingue les règles métier de la prédiction du modèle.
- Les données sont synthétiques ; une prédiction ne prouve pas une attaque.
- Ne déclare pas une attaque confirmée sans décision humaine.
- N'appelle jamais un outil de décision de revue humaine.
- Ne prétends jamais avoir bloqué un compte ou révoqué une session.
- Si une donnée nécessaire manque, demande une clarification.
- N'utilise jamais l'heure habituelle du profil comme heure réelle
  de la tentative de connexion.
"""


# ============================================================
# VALIDATION DES INFORMATIONS FOURNIES
# ============================================================

def normalize_text(text: str) -> str:
    """Normalise le texte pour faciliter la détection des formulations."""
    text = unicodedata.normalize("NFKD", text.casefold())

    return "".join(
        char
        for char in text
        if not unicodedata.combining(char)
    )


def is_connection_analysis_request(question: str) -> bool:
    """Détecte une demande d'analyse de connexion ou d'accès."""
    text = normalize_text(question)

    has_analysis_intent = bool(
        re.search(
            r"\b(analyse|analyser|analyze|evalue|evaluer|investigue)\b",
            text,
        )
    )

    has_connection_context = bool(
        re.search(
            r"\b(connexion|connecter|login|authentification|acces)\b",
            text,
        )
    )

    return has_analysis_intent and has_connection_context


def extract_explicit_connection_hour(question: str) -> int | None:
    """
    Extrait une heure explicitement associée à une connexion.

    Exemples :
        connexion à 14 heures -> 14
        connexion à 09h30 -> 9
        connexion à 22:15 -> 22

    L'heure habituelle du profil ne doit jamais être utilisée ici.
    """
    text = normalize_text(question)

    event_pattern = re.compile(
        r"\b(connexion|connecter|login|authentification|acces)\b"
    )

    time_pattern = re.compile(
        r"\b(?:a|vers|at|around)\s*"
        r"(?P<hour>\d{1,2})"
        r"(?:\s*h\s*(?P<minute>\d{1,2})?"
        r"|\s*:\s*(?P<minute_colon>\d{2})"
        r"|\s+heures?)\b"
    )

    for match in time_pattern.finditer(text):
        preceding_text = text[
            max(0, match.start() - 120):match.start()
        ]

        if not event_pattern.search(preceding_text):
            continue

        hour = int(match.group("hour"))

        minute = (
            match.group("minute")
            or match.group("minute_colon")
        )

        if not 0 <= hour <= 23:
            continue

        if minute is not None and not 0 <= int(minute) <= 59:
            continue

        return hour

    return None


def build_clarification_result(question: str) -> dict:
    """Construit une réponse sans appeler MCP ou OpenRouter."""
    clarification = (
        "Il me manque l'heure réelle de la connexion pour effectuer "
        "cette analyse.\n\n"
        "Quelle était l'heure exacte de la tentative de connexion "
        "(entre 0 h et 23 h) ?\n\n"
        "Je ne peux pas déduire cette valeur de l'heure habituelle "
        "enregistrée dans le profil utilisateur."
    )

    print(clarification)

    return {
        "status": "completed",
        "outcome": "clarification_required",
        "question": question,
        "available_tools": [],
        "tools_called": [],
        "tool_trace": [],
        "tool_results": [],
        "final_report": clarification,
        "rounds": 0,
        "missing_fields": ["hour"],
    }


# ============================================================
# CONVERSION DES RÉSULTATS MCP
# ============================================================

def result_to_json(result) -> str:
    """Convertit un résultat MCP en JSON exploitable par le modèle."""

    if result.is_error:
        messages = [
            getattr(block, "text", str(block))
            for block in result.content
        ]

        return json.dumps(
            {
                "error": True,
                "details": messages,
            },
            ensure_ascii=False,
        )

    if result.structured_content is not None:
        return json.dumps(
            result.structured_content,
            ensure_ascii=False,
            default=str,
        )

    messages = [
        getattr(block, "text", str(block))
        for block in result.content
    ]

    return json.dumps(
        {"content": messages},
        ensure_ascii=False,
    )


# ============================================================
# AGENT PRINCIPAL
# ============================================================

async def run_agent(question: str) -> dict:
    """Exécute l'agent et retourne une trace d'exécution vérifiable."""

    question = question.strip()

    if not question:
        raise ValueError("La demande ne peut pas être vide.")

    # --------------------------------------------------------
    # 1. Validation déterministe avant tout appel externe
    # --------------------------------------------------------

    is_analysis_request = is_connection_analysis_request(question)

    expected_hour = None

    if is_analysis_request:
        expected_hour = extract_explicit_connection_hour(question)

        if expected_hour is None:
            return build_clarification_result(question)

    # --------------------------------------------------------
    # 2. Vérification de la configuration OpenRouter
    # --------------------------------------------------------

    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY absent. Configure cette variable "
            "dans ton environnement ou dans ton fichier .env."
        )

    # --------------------------------------------------------
    # 3. Configuration du serveur MCP
    # --------------------------------------------------------

    child_env = {
        "IDENTITYSHIELD_ENABLE_MCP_REVIEW_TOOL": "false",
    }

    env_names = [
        "IDENTITYSHIELD_SECRET_KEY",
        "IDENTITYSHIELD_ADMIN_USERNAME",
        "IDENTITYSHIELD_ADMIN_PASSWORD",
        "IDENTITYSHIELD_ANALYST_USERNAME",
        "IDENTITYSHIELD_ANALYST_PASSWORD",
        "IDENTITYSHIELD_VIEWER_USERNAME",
        "IDENTITYSHIELD_VIEWER_PASSWORD",
    ]

    for name in env_names:
        value = os.getenv(name)

        if value:
            child_env[name] = value

    server = StdioServerParameters(
        command=sys.executable,
        args=["-m", "identityshield_mcp.server"],
        env=child_env,
    )

    # --------------------------------------------------------
    # 4. Client LLM
    # --------------------------------------------------------

    llm = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    tool_trace = []
    tool_results = []

    # --------------------------------------------------------
    # 5. Connexion MCP
    # --------------------------------------------------------

    async with Client(server) as mcp_client:

        response = await mcp_client.list_tools()

        tool_map = {
            tool.name: tool
            for tool in response.tools
            if tool.name in ALLOWED_TOOLS
        }

        missing = ALLOWED_TOOLS - set(tool_map)

        if missing:
            raise RuntimeError(
                f"Outils MCP manquants : {sorted(missing)}"
            )

        llm_tools = [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or tool.name,
                    "parameters": tool.input_schema,
                },
            }
            for tool in tool_map.values()
        ]

        print(
            "Outils disponibles :",
            ", ".join(tool_map),
        )

        messages = [
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": question,
            },
        ]

        # ----------------------------------------------------
        # 6. Boucle d'interaction avec le modèle
        # ----------------------------------------------------

        for round_number in range(MAX_TOOL_ROUNDS + 1):

            completion = await llm.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=llm_tools,
                tool_choice="auto",
                parallel_tool_calls=False,
            )

            assistant_message = completion.choices[0].message
            tool_calls = assistant_message.tool_calls or []

            # ------------------------------------------------
            # 7. Réponse finale du modèle
            # ------------------------------------------------

            if not tool_calls:

                final_report = (
                    assistant_message.content
                    or "Aucune réponse textuelle."
                )

                print("\n=== Rapport d'investigation ===\n")
                print(final_report)

                tools_called = list(dict.fromkeys(
                    item["name"]
                    for item in tool_trace
                    if item["executed"]
                ))

                return {
                    "status": "completed",
                    "question": question,
                    "available_tools": list(tool_map),
                    "tools_called": tools_called,
                    "tool_trace": tool_trace,
                    "tool_results": tool_results,
                    "final_report": final_report,
                    "rounds": round_number + 1,
                }

            # ------------------------------------------------
            # 8. Protection contre les appels excessifs
            # ------------------------------------------------

            if round_number >= MAX_TOOL_ROUNDS:

                for tool_call in tool_calls:
                    tool_trace.append({
                        "name": tool_call.function.name,
                        "arguments": None,
                        "authorized": False,
                        "executed": False,
                        "is_error": True,
                        "blocked_reason": "Maximum tool rounds reached",
                    })

                print("Limite d'appels d'outils atteinte.")

                return {
                    "status": "max_tool_rounds",
                    "question": question,
                    "available_tools": list(tool_map),
                    "tools_called": list(dict.fromkeys(
                        item["name"]
                        for item in tool_trace
                        if item["executed"]
                    )),
                    "tool_trace": tool_trace,
                    "tool_results": tool_results,
                    "final_report": None,
                    "rounds": round_number + 1,
                }

            messages.append(
                assistant_message.model_dump(exclude_none=True)
            )

            # ------------------------------------------------
            # 9. Exécution contrôlée des outils
            # ------------------------------------------------

            for tool_call in tool_calls:

                name = tool_call.function.name
                arguments = None
                authorized = name in tool_map
                executed = False
                is_error = False

                if not authorized:

                    output_data = {
                        "error": True,
                        "details": "Outil non autorise.",
                    }

                    is_error = True

                else:

                    try:

                        arguments = json.loads(
                            tool_call.function.arguments or "{}"
                        )

                        if not isinstance(arguments, dict):
                            raise ValueError(
                                "Les arguments doivent former un objet JSON."
                            )

                        # ------------------------------------
                        # Protection supplémentaire de l'heure
                        # ------------------------------------

                        if name == "analyze_access_event":

                            supplied_hour = arguments.get("hour")

                            if expected_hour is None:
                                raise ValueError(
                                    "Analyse bloquée : l'heure réelle "
                                    "de connexion n'a pas été fournie."
                                )

                            if (
                                isinstance(supplied_hour, bool)
                                or not isinstance(supplied_hour, int)
                                or supplied_hour != expected_hour
                            ):
                                raise ValueError(
                                    "Analyse bloquée : l'heure fournie "
                                    "à l'outil ne correspond pas à "
                                    "l'heure indiquée par l'utilisateur."
                                )

                        print(f"Appel MCP : {name}")

                        result = await mcp_client.call_tool(
                            name,
                            arguments,
                        )

                        executed = True
                        is_error = bool(result.is_error)

                        output_data = json.loads(
                            result_to_json(result)
                        )

                    except (ValueError, json.JSONDecodeError) as exc:

                        output_data = {
                            "error": True,
                            "details": str(exc),
                        }

                        is_error = True

                    except Exception as exc:

                        output_data = {
                            "error": True,
                            "details": (
                                f"Erreur d'exécution MCP : "
                                f"{type(exc).__name__}: {exc}"
                            ),
                        }

                        is_error = True

                # --------------------------------------------
                # Enregistrement de la trace
                # --------------------------------------------

                tool_trace.append({
                    "name": name,
                    "arguments": arguments,
                    "authorized": authorized,
                    "executed": executed,
                    "is_error": is_error,
                })

                tool_results.append({
                    "tool": name,
                    "is_error": is_error,
                    "result": output_data,
                })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(
                        output_data,
                        ensure_ascii=False,
                        default=str,
                    ),
                })

    # --------------------------------------------------------
    # 10. Fermeture inattendue de la connexion
    # --------------------------------------------------------

    return {
        "status": "connection_closed",
        "question": question,
        "available_tools": [],
        "tools_called": [],
        "tool_trace": tool_trace,
        "tool_results": tool_results,
        "final_report": None,
        "rounds": 0,
    }


# ============================================================
# MODE INTERACTIF
# ============================================================

def main() -> None:

    question = input("Demande d'investigation > ").strip()

    if not question:
        print("Saisis une demande avant de lancer l'agent.")
        return

    try:
        asyncio.run(run_agent(question))

    except KeyboardInterrupt:
        print("\nAgent arrêté.")

    except Exception as exc:
        print(
            f"Erreur de l'agent : "
            f"{type(exc).__name__}: {exc}"
        )


if __name__ == "__main__":
    main()
