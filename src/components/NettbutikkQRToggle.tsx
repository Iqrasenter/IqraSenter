import Image from "next/image";
import { Smartphone } from "lucide-react";

const VIPPS_LINK = "https://qr.vipps.no/vp/mSPWvQajp";

export function NettbutikkVippsAction() {
  return (
    <div className="mt-6 flex flex-col items-center">
      {/* Desktop: show QR code directly */}
      <div className="hidden md:flex flex-col items-center">
        <div className="bg-white rounded-2xl p-5 card-pop">
          <div className="w-[180px] h-[180px] rounded-xl border border-border/20 overflow-hidden">
            <Image
              src="/images/qr-nettbutikk.png"
              alt="QR-kode — scan for å betale med Vipps"
              width={180}
              height={180}
              className="w-full h-full object-contain"
            />
          </div>
          <p className="mt-3 text-center text-sm text-text-muted font-body">
            Scan med mobilen for å åpne Vipps
          </p>
        </div>
      </div>

      {/* Mobile: direct Vipps link */}
      <a
        href={VIPPS_LINK}
        className="md:hidden inline-flex items-center gap-2.5 px-7 py-3.5 text-white font-heading font-semibold rounded-full transition-colors duration-300 shadow-lg text-base"
        style={{ backgroundColor: "#ff5b24" }}
      >
        <Smartphone size={18} />
        Åpne i Vipps
      </a>
    </div>
  );
}
