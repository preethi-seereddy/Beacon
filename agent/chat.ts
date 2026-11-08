// Chat with Beau in the terminal: same brain and same replies as iMessage, no Photon needed.
//   npm run beau:chat
// Works with zero keys (rule-based replies). Add NVIDIA_API_KEY / OPENAI_API_KEY for the AI
// brain, and Supabase keys to make reports show up on the website map.

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { brainLabel, dataLabel, respond } from "./core";

async function main() {
  console.log("\n✨ Beau (terminal chat)");
  console.log(`   brain: ${brainLabel}`);
  console.log(`   data:  ${dataLabel}`);
  console.log('   Try: "route from the union to the library", "the SSA ramp is blocked", HELP. Type "quit" to exit.\n');

  const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  const prompt = () => stdout.write("you  › ");
  prompt();
  for await (const line of rl) {
    const text = line.trim();
    if (!stdin.isTTY && text) console.log(text); // echo when input is piped
    if (/^(quit|exit|bye)$/i.test(text)) break;
    if (text) {
      try {
        const reply = await respond({ platform: "terminal", handle: "terminal-demo", spaceId: "terminal-demo", agentUserId: "terminal", text, photos: [] });
        console.log(`\nbeau › ${reply.replace(/\n/g, "\n       ")}\n`);
      } catch (err) {
        console.log(`\n(beau hit an error: ${(err as Error).message})\n`);
      }
    }
    prompt();
  }
  rl.close();
  process.exit(0);
}

main();
