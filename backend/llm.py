"""
Wrapper litellm — ÚNICO punto de configuración del LLM en Adkio.
Para cambiar de modelo: setear LLM_MODEL en .env. Sin tocar código.

Modelos disponibles:
  groq/llama-3.3-70b-versatile   (default — gratis)
  gemini/gemini-2.0-flash         (alternativa gratuita)
  anthropic/claude-sonnet-4-5     (mejor tool use — activar con créditos)
"""
import os
from litellm import completion

LLM_MODEL = os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile")


def call_llm(messages: list, tools: list = None, stream: bool = False):
    kwargs = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": stream,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    return completion(**kwargs)
