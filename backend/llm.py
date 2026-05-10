import os
from litellm import completion

LLM_MODEL = os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile")


def call_llm(messages: list[dict], tools: list[dict] | None = None, stream: bool = False):
    kwargs = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": stream,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    return completion(**kwargs)
