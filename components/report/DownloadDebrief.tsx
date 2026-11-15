"use client";

// Saves the debrief as a Markdown file, built in the browser from the attempt
// and its report (components/report/debrief.ts). Nothing is uploaded.
export function DownloadDebrief({ build, className, testId = "download-debrief" }: { build: () => string; className: string; testId?: string }) {
  function save() {
    const url = URL.createObjectURL(new Blob([build()], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `interviewlenz-debrief-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" onClick={save} className={className} data-testid={testId}>
      Download debrief
    </button>
  );
}
