// Beau's reasoning loop (NVIDIA Nemotron or OpenAI, OpenAI-compatible tool calling).
//
// This is the multi-step part NVIDIA's track asks for: the model is allowed to
// call tools repeatedly before it answers, so "the ramp by the library is
// blocked" can become resolve_location -> clarifying question -> submit_report
// without the user ever naming a graph edge.

import { TOOLS, SYSTEM_PROMPT } from "./tools";
import { IMPL, type ToolContext } from "./toolImpl";

// OpenAI-compatible chat completions. NVIDIA Nemotron by default; set OPENAI_API_KEY
// instead (and no NVIDIA key) to run Beau on OpenAI.
const USE_NVIDIA = Boolean(process.env.NVIDIA_API_KEY);
const BASE = USE_NVIDIA
  ? process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1"
  : process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const MODEL = USE_NVIDIA
  ? process.env.NEMOTRON_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1"
  : process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const KEY = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
export const MODEL_LABEL = USE_NVIDIA ? `Nemotron (${MODEL})` : `OpenAI (${MODEL})`;

export type Msg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

/** Cap the loop so a confused model can't bill you forever. */
const MAX_TURNS = 6;

export async function runBeau(
  userText: string,
  history: Msg[] = [],
  ctx: ToolContext = { source: "imessage" }
): Promise<{ reply: string; steps: string[]; history: Msg[] }> {
  if (!KEY) throw new Error("Set NVIDIA_API_KEY or OPENAI_API_KEY");

  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userText },
  ];
  const steps: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, temperature: 0.2 }),
    });
    if (!res.ok) throw new Error(`${MODEL_LABEL} ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error("no completion returned");
    messages.push(choice);

    const calls = choice.tool_calls ?? [];
    if (calls.length === 0) {
      return { reply: choice.content ?? "", steps, history: messages.slice(1) };
    }

    // Run every tool the model asked for, then hand the results back.
    for (const call of calls) {
      const name = call.function?.name;
      let args: any = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        /* malformed args: let the tool reject them below */
      }
      const fn = IMPL[name];
      let result: unknown;
      try {
        result = fn ? await fn(args, ctx) : { error: `unknown tool ${name}` };
      } catch (err) {
        // A tool failure (e.g. database down) goes back to the model as data,
        // so Beau can say so honestly instead of the whole turn crashing.
        result = { error: "tool_failed", detail: (err as Error).message };
      }
      steps.push(`${name}(${JSON.stringify(args)})`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: "I got a little tangled up working that out. Can you rephrase?",
    steps,
    history: messages.slice(1),
  };
}
