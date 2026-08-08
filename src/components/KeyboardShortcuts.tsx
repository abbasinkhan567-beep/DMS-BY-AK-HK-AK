"use client";

import { useEffect } from "react";

function isTyping(el: EventTarget | null) {
  return (
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

export function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as EventTarget | null;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const save = document.querySelector<HTMLElement>("[data-save]:not([disabled])");
        save?.click();
        return;
      }

      if (isTyping(target)) return;

      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-search]");
        input?.focus();
        input?.select();
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const add = document.querySelector<HTMLElement>("[data-add-new]");
        add?.click();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}