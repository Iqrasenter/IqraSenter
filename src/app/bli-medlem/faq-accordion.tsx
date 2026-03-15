"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Hva koster medlemskap?",
    answer:
      "Kontakt oss for informasjon om priser og medlemsfordeler.",
  },
  {
    question: "Hvem kan bli medlem?",
    answer:
      "Alle familier er velkomne! Vi tilbyr aktiviteter for barn, unge og voksne.",
  },
  {
    question: "Når er helgeskolen?",
    answer:
      "Helgeskolen arrangeres hver lørdag og søndag. Kontakt oss for timeplan.",
  },
  {
    question: "Hvor holder dere til?",
    answer:
      "Vi holder til i Ryenstubben 2, 0679 Oslo — 5 minutter fra Ryen T-bane.",
  },
  {
    question: "Hvordan melder jeg meg inn?",
    answer:
      "Send en e-post til info@iqrasenter.net eller ring oss på +47 998 64 331, så hjelper vi deg i gang.",
  },
] as const;

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <div className="space-y-2 lg:space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={item.question}
            className="rounded-xl lg:rounded-2xl bg-card border border-border/50 overflow-hidden transition-shadow duration-200 hover:shadow-sm"
          >
            <button
              onClick={() => toggle(index)}
              className="flex items-center justify-between w-full px-4 lg:px-6 py-3 lg:py-5 text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <span className="font-heading font-semibold text-xs lg:text-base text-text pr-4">
                {item.question}
              </span>
              <ChevronDown
                size={20}
                className={`shrink-0 text-text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""
                  }`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
            >
              <div className="overflow-hidden">
                <p className="px-4 lg:px-6 pb-3 lg:pb-5 text-xs lg:text-base text-text-muted leading-relaxed">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
