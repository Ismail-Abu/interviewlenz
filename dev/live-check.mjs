// Dev-only: prove the Gemini Live path works with the real key (closes the B2
// v1alpha/v1beta risk). Not shipped with the app.
//
// Mints an ephemeral token the same way app/api/live-token does, opens a Live
// session with it, sends one text turn, and reports whether audio and/or a
// transcript come back. Tries v1beta first, then v1alpha. The key is read from
// .env.local and is never printed.
//
// Run (dev server not required): node dev/live-check.mjs

import { readFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";

function loadEnvLocal() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

const env = loadEnvLocal();
const KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
const MODEL = process.env.LIVE_MODEL || env.LIVE_MODEL;
if (!KEY || !MODEL) {
  console.error("Missing GEMINI_API_KEY or LIVE_MODEL in .env.local");
  process.exit(1);
}

async function tryVersion(apiVersion) {
  const result = { apiVersion, opened: false, audioBytes: 0, transcript: "", ok: false, error: null };
  let token;
  try {
    const server = new GoogleGenAI({ apiKey: KEY, httpOptions: { apiVersion } });
    const minted = await server.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: MODEL,
          config: { responseModalities: [Modality.AUDIO], sessionResumption: {} },
        },
      },
    });
    token = minted.name;
  } catch (e) {
    result.error = `token.create failed: ${e?.message || String(e)}`;
    return result;
  }

  const client = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } });
  return await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      result.ok = result.audioBytes > 0 || result.transcript.length > 0;
      resolve(result);
    };
    const hardStop = setTimeout(finish, 20000);

    client.live
      .connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            result.opened = true;
          },
          onmessage: (m) => {
            if (m.data) result.audioBytes += m.data.length;
            const t = m.serverContent?.outputTranscription?.text;
            if (t) result.transcript += t;
            if (m.serverContent?.turnComplete) {
              clearTimeout(hardStop);
              setTimeout(finish, 300);
            }
          },
          onerror: (e) => {
            result.error = `ws error: ${e?.message || String(e)}`;
            clearTimeout(hardStop);
            finish();
          },
          onclose: (e) => {
            if (!result.ok && !result.error) result.error = `closed: ${e?.reason || "no reason"}`;
            clearTimeout(hardStop);
            finish();
          },
        },
      })
      .then((session) => {
        session.sendClientContent({ turns: "Say hello in one sentence.", turnComplete: true });
      })
      .catch((e) => {
        result.error = `connect failed: ${e?.message || String(e)}`;
        clearTimeout(hardStop);
        finish();
      });
  });
}

const summary = [];
for (const version of ["v1beta", "v1alpha"]) {
  process.stdout.write(`\n[${version}] minting token + connecting...\n`);
  const r = await tryVersion(version);
  summary.push(r);
  console.log(
    `[${version}] opened=${r.opened} audioBytes=${r.audioBytes} transcript=${JSON.stringify(r.transcript.slice(0, 120))}` +
      (r.error ? ` error=${r.error}` : "") +
      ` => ${r.ok ? "WORKS" : "no audio/transcript"}`,
  );
  if (r.ok) {
    console.log(`\nVERDICT: Live works on ${version} (model ${MODEL}).`);
    process.exit(0);
  }
}

console.log("\nVERDICT: Live did not return audio/transcript on either version.");
for (const r of summary) console.log(`  ${r.apiVersion}: ${r.error || "no data"}`);
process.exit(2);
