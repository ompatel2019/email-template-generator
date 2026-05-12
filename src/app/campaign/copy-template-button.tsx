"use client";

import { useState } from "react";

export function CopyTemplateButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    await writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      className="h-10 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28]"
      onClick={copyTemplate}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}
