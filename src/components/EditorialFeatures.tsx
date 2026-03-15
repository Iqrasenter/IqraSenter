'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '@/lib/constants';

type ServiceTitle = (typeof SERVICES)[number]['title'];

const categoryMap: Record<ServiceTitle, string> = {
  Helgeskole: 'Utdanning',
  Fritidsaktiviteter: 'Aktiviteter',
  'Kurs og opplæring': 'Kurs',
};

const linkMap: Record<ServiceTitle, string> = {
  Helgeskole: '/om-oss',
  Fritidsaktiviteter: '/om-oss',
  'Kurs og opplæring': '/om-oss',
};

function EditorialRow({
  service,
  index,
  imageLeft,
}: {
  service: (typeof SERVICES)[number];
  index: number;
  imageLeft: boolean;
}) {
  return (
    <motion.div
      className="relative grid grid-cols-1 lg:grid-cols-2 items-stretch overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
    >
      {/* Top-edge shimmer */}
      <div
        className="absolute top-0 left-[20%] right-[20%] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(110,231,183,0.5), transparent)' }}
      />

      {/* Image */}
      <div
        className={`relative aspect-[4/3] lg:aspect-auto min-h-[200px] lg:min-h-[280px] ${
          imageLeft ? 'lg:order-1' : 'lg:order-2'
        }`}
      >
        <Image
          src={service.image}
          alt={service.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          quality={90}
        />
        {/* Gradient overlay fading into glass side */}
        <div
          className="absolute inset-0"
          style={{
            background: imageLeft
              ? 'linear-gradient(to right, transparent 60%, rgba(6,78,59,0.6))'
              : 'linear-gradient(to left, transparent 60%, rgba(6,78,59,0.6))',
          }}
        />
      </div>

      {/* Text content */}
      <div
        className={`flex flex-col gap-3 md:gap-4 p-6 sm:p-8 lg:p-10 justify-center ${
          imageLeft ? 'lg:order-2' : 'lg:order-1'
        }`}
      >
        <span className="inline-block w-fit px-3 py-1.5 rounded-full text-xs font-semibold font-body uppercase tracking-wider text-[#34D399]"
          style={{ background: 'rgba(52,211,153,0.15)' }}
        >
          {categoryMap[service.title]}
        </span>

        <h3 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold text-white leading-tight">
          {service.title}
        </h3>

        <p className="leading-relaxed text-sm md:text-base lg:text-lg font-body" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {service.description}
        </p>

        <Link
          href={linkMap[service.title]}
          className="group inline-flex items-center gap-2 w-fit px-6 py-3 mt-1 text-white font-heading font-semibold rounded-full transition-all duration-300 btn-magnetic text-sm"
          style={{
            background: 'linear-gradient(135deg, #C8973E, #D4AD5A)',
            boxShadow: '0 4px 12px rgba(200,151,62,0.3)',
          }}
        >
          Les mer
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </motion.div>
  );
}

export function EditorialFeatures() {
  return (
    <div
      className="relative w-full overflow-hidden py-16 md:py-24 px-4 sm:px-6 lg:px-8"
      style={{ background: 'linear-gradient(160deg, #022c22 0%, #064E3B 40%, #0a3d2e 100%)' }}
    >
      {/* Glow orbs */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: '20%', left: '10%', width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)',
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          bottom: '10%', right: '15%', width: '250px', height: '250px',
          background: 'radial-gradient(circle, rgba(52,211,153,0.15), transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Section heading */}
        <div className="text-center mb-10 md:mb-14">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold font-body uppercase tracking-wider mb-4 text-[#34D399]"
            style={{ background: 'rgba(52,211,153,0.2)' }}
          >
            Hva vi tilbyr
          </span>
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-[900] text-white">
            Våre <em className="not-italic" style={{ color: '#34D399' }}>Tjenester</em>
          </h2>
        </div>

        {/* Alternating rows */}
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          {SERVICES.map((service, index) => (
            <EditorialRow
              key={service.title}
              service={service}
              index={index}
              imageLeft={index % 2 === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
