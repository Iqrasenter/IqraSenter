"use client";

import { useState } from "react";
import Image from "next/image";
import { Smartphone, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function NettbutikkQRToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-5 flex flex-col items-center">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-light text-white font-heading font-semibold rounded-container transition-colors duration-300 shadow-lg btn-magnetic text-sm"
      >
        <Smartphone size={16} />
        Scan & handle i appen
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 bg-white rounded-container-lg card-pop p-5 text-center">
              <div className="w-[150px] h-[150px] mx-auto rounded-container border border-border/30 overflow-hidden">
                <Image
                  src="/images/qr-nettbutikk.png"
                  alt="QR-kode for Iqra nettbutikk"
                  width={150}
                  height={150}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="mt-3 text-sm text-text-muted">
                Scan for å åpne nettbutikken
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
