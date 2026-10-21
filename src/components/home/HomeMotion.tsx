"use client";

import { useEffect } from "react";

// Parts of each section that rise into place as it scrolls into view.
// Nothing is hidden until this has run, so the page reads fine without script.
const HOME_TARGETS = [
  ".offering h2",
  ".intro-copy",
  ".programme",
  ".programme-photo",
  ".newsroom .heading > *",
  ".lead-story",
  ".desk-story",
  ".news-desk > .link",
  ".portrait-copy > *",
  ".portrait-photo",
  ".open .header > *",
  ".open-vipps",
  ".open-bank",
  ".open-monthly",
  ".invite-copy > *",
  ".invitation .photo",
  ".footer-grid > *",
].join(",");

export function HomeMotion({ targets: selector = HOME_TARGETS }: { targets?: string }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".iqra-home");
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
    const perSection = new Map<Element, number>();
    targets.forEach((el) => {
      const section = el.closest("section, footer") ?? root;
      const n = perSection.get(section) ?? 0;
      perSection.set(section, n + 1);
      el.classList.add("rv");
      el.style.setProperty("--rv-delay", `${Math.min(n, 5) * 80}ms`);
    });
    root.classList.add("has-motion");

    // An element is revealed once its top edge is inside the viewport, or above
    // it after a jump or fast scroll, so nothing is ever left hidden behind.
    const pending = new Set(targets);
    let frame = 0;
    const check = () => {
      frame = 0;
      const line = window.innerHeight * 0.92;
      pending.forEach((el) => {
        if (el.getBoundingClientRect().top < line) {
          el.classList.add("in");
          pending.delete(el);
        }
      });
      if (pending.size === 0) {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.classList.remove("has-motion");
      targets.forEach((el) => {
        el.classList.remove("rv", "in");
        el.style.removeProperty("--rv-delay");
      });
    };
  }, [selector]);

  return null;
}
