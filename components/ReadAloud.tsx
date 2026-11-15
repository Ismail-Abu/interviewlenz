"use client";

import { useEffect, useRef, useState } from "react";

export function ReadAloud({ text, label }: { text: string; label: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  async function toggle() {
    if (stop.current) {
      stop.current();
      return;
    }
    window.dispatchEvent(new Event("interviewlenz-stop-read-aloud"));
    const controller = new AbortController();
    const audio = new Audio();
    let url = "";
    let usingBrowserSpeech = false;
    function finish() {
      if (controller.signal.aborted) return;
      window.removeEventListener("interviewlenz-stop-read-aloud", finish);
      controller.abort();
      audio.pause();
      if (url) URL.revokeObjectURL(url);
      if (usingBrowserSpeech) window.speechSynthesis.cancel();
      stop.current = null;
      setActive(false);
    }
    window.addEventListener("interviewlenz-stop-read-aloud", finish);
    stop.current = finish;
    setActive(true);
    setError("");
    const passage = text.trim().slice(0, 2500);
    try {
      const response = await fetch("/api/elevenlabs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: passage }), signal: controller.signal,
      });
      if (response.ok && response.headers.get("content-type")?.startsWith("audio/mpeg")) {
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = finish;
        audio.onerror = () => { setError("Audio playback failed. Try again."); finish(); };
        await audio.play();
        return;
      }
    } catch {
      // Browser speech also works when the provider or network is unavailable.
    }
    if (controller.signal.aborted) return;
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is unavailable in this browser.");
      finish();
      return;
    }
    usingBrowserSpeech = true;
    const utterance = new SpeechSynthesisUtterance(passage);
    utterance.lang = "en-US";
    utterance.onend = finish;
    utterance.onerror = () => {
      if (!controller.signal.aborted) setError("Browser speech could not play.");
      finish();
    };
    window.speechSynthesis.speak(utterance);
  }

  return <div>
    <button type="button" aria-pressed={active} onClick={toggle} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
      {active ? "Stop playback" : label}
    </button>
    {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
  </div>;
}
