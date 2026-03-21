'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '@/lib/constants';

type ServiceTitle = (typeof SERVICES)[number]['title'];

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
      className="relative grid grid-cols-1 lg:grid-cols-2 items-stretch overflow-hidden bg-white rounded-container-lg card-pop"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
    >
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
          quality={75}
        />
      </div>

      {/* Text content */}
      <div
        className={`flex flex-col gap-3 md:gap-4 p-6 sm:p-8 lg:p-10 justify-center ${
          imageLeft ? 'lg:order-2' : 'lg:order-1'
        }`}
      >
        <h3 className="font-heading text-lg md:text-xl lg:text-2xl font-bold text-text leading-tight">
          {service.title}
        </h3>

        <p className="leading-relaxed text-sm md:text-base lg:text-lg font-body text-text-muted">
          {service.description}
        </p>

        <Link
          href={linkMap[service.title]}
          className="group inline-flex items-center gap-2 w-fit px-6 py-3 mt-1 bg-white text-accent font-heading font-medium rounded-full transition-[border-color] duration-300 btn-magnetic text-sm border-2 border-accent/25 hover:border-accent"
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
    <div className="relative w-full overflow-hidden py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-bg">
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Section heading */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-heading text-lg sm:text-xl lg:text-2xl font-bold text-text">
            Våre <em className="not-italic text-primary">Tjenester</em>
          </h2>
          <p className="mt-3 text-sm sm:text-base max-w-2xl leading-relaxed mx-auto text-text-muted">
            Aktiviteter og opplæring for hele familien
          </p>
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
