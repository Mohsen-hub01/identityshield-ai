import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from mcp import Client, StdioServerParameters
from openai import AsyncOpenAI


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MODEL = os.getenv("IDENTITYSHIELD_LLM_MODEL", "openai/gpt-4o-mini")
MAX_TOOL_ROUNDS = 4

# L'agent ne dispose que d'outils de lecture et d'analyse.
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
- Si une donnée nécessaire manque, indique-le explicitement.
"""

def result_to_json(result) -> str:
    """Convert an MCP result into content the model can read."""
    if result.is_error:
        messages = [
            getattr(block, "text", str(block))
            for block in result.content
        ]
        return json.dumps(
            {"error": True, "details": messages},
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
    return json.dumps({"content": messages}, ensure_ascii=False)


async def run_agent(question: str) -> None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY absent. Configure cette variable "
            "dans ton environnement ou dans ton fichier .env."
        )

    # Transmettre au serveur local uniquement les paramètres nécessaires.
    # L'outil de décision humaine reste désactivé.
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
        args=[str(BASE_DIR / "mcp_server.py")],
        env=child_env,
    )

    llm = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

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

        # Convertit les schémas MCP en outils OpenAI/OpenRouter.
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

        print("Outils disponibles :", ", ".join(tool_map))
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ]

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

            if not tool_calls:
                print("\n=== Rapport d'investigation ===\n")
                print(assistant_message.content or "Aucune réponse textuelle.")
                return

            if round_number >= MAX_TOOL_ROUNDS:
                print("Limite d'appels d'outils atteinte. Arrêt de l'agent.")
                return

            messages.append(
                assistant_message.model_dump(exclude_none=True)
            )

            for tool_call in tool_calls:
                name = tool_call.function.name

                if name not in tool_map:
                    output = json.dumps(
                        {"error": True, "details": "Outil non autorisé."},
                        ensure_ascii=False,
                    )
                else:
                    try:
                        arguments = json.loads(
                            tool_call.function.arguments or "{}"
                        )
                        if not isinstance(arguments, dict):
                            raise ValueError(
                                "Les arguments doivent former un objet JSON."
                            )

                        print(f"Appel MCP : {name}")

                        result = await mcp_client.call_tool(
                            name,
                            arguments,
                        )
                        output = result_to_json(result)

                    except (ValueError, json.JSONDecodeError) as exc:
                        output = json.dumps(
                            {"error": True, "details": str(exc)},
                            ensure_ascii=False,
                        )

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": output,
                    }
                )


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
        print(f"Erreur de l'agent : {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
