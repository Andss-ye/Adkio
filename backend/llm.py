"""
Wrapper litellm — ÚNICO punto de configuración del LLM en Adkio.
Para cambiar de modelo: setear LLM_MODEL en .env. Sin tocar código.

Modelos disponibles:
  groq/llama-3.3-70b-versatile   (default — gratis)
  gemini/gemini-2.0-flash         (alternativa gratuita)
  anthropic/claude-sonnet-4-5     (mejor tool use — activar con créditos)
"""
import logging
import os
import time

from litellm import completion

logger = logging.getLogger(__name__)

LLM_MODEL = os.environ.get("LLM_MODEL", "anthropic/claude-sonnet-4-5")

# Hard caps — never let a single call drain quota uncapped
MAX_TOKENS_CAMPAIGN = int(os.environ.get("MAX_TOKENS_CAMPAIGN", "2000"))
MAX_TOKENS_ONBOARDING = int(os.environ.get("MAX_TOKENS_ONBOARDING", "500"))


def call_llm(
    messages: list,
    tools: list = None,
    stream: bool = False,
    max_tokens: int = MAX_TOKENS_CAMPAIGN,
) -> object:
    kwargs = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": stream,
        "max_tokens": max_tokens,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    t0 = time.monotonic()
    response = completion(**kwargs)
    elapsed = time.monotonic() - t0

    # Log token usage — basic cost visibility
    try:
        usage = response.usage
        logger.info(
            "llm call model=%s prompt=%d completion=%d total=%d elapsed=%.2fs",
            LLM_MODEL,
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.total_tokens,
            elapsed,
        )
    except Exception:
        pass

    return response
