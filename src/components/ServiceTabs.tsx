"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Users, GraduationCap, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/constants";

type ServiceTitle = (typeof SERVICES)[number]["title"];

const iconMap: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="h-auto w-4 shrink-0" />,
  Users: <Users className="h-auto w-4 shrink-0" />,
  GraduationCap: <GraduationCap className="h-auto w-4 shrink-0" />,
};

const categoryMap: Record<ServiceTitle, string> = {
  Helgeskole: "Utdanning",
  Fritidsaktiviteter: "Aktiviteter",
  "Kurs og opplæring": "Kurs",
};

const linkMap: Record<ServiceTitle, string> = {
  Helgeskole: "/om-oss",
  Fritidsaktiviteter: "/om-oss",
  "Kurs og opplæring": "/om-oss",
};

const tabs = SERVICES.map((service, i) => ({
  value: `tab-${i + 1}`,
  icon: iconMap[service.icon],
  label: service.title,
  content: {
    badge: categoryMap[service.title],
    title: service.title,
    description: service.description,
    buttonText: "Les mer",
    imageSrc: service.image,
    imageAlt: service.title,
    href: linkMap[service.title],
  },
}));

export function ServiceTabs() {
  const [activeTab, setActiveTab] = useState(tabs[0].value);
  const activeContent = tabs.find((t) => t.value === activeTab)!;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 flex flex-col h-full">
      {/* Tab triggers — horizontally scrollable on mobile */}
      <TabsList className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pb-2 sm:pb-0">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 md:px-6 md:py-3 text-sm font-semibold text-text-muted transition-all duration-300 whitespace-nowrap shrink-0
              data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md
              hover:bg-primary/5 hover:text-primary cursor-pointer btn-magnetic"
          >
            {tab.icon} {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab content with crossfade */}
      <div className="mt-4 md:mt-6 rounded-container bg-bg-warm border border-border/30 p-4 sm:p-6 lg:p-12 flex-1 min-h-0 flex flex-col justify-center shadow-lg overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid place-items-center gap-6 md:gap-10 lg:grid-cols-2 lg:gap-12"
          >
            {/* Text side */}
            <div className="flex flex-col gap-3 md:gap-4 border-l-4 border-accent/30 pl-4 md:pl-6">
              <Badge variant="outline" className="w-fit bg-primary/5">
                {activeContent.content.badge}
              </Badge>
              <h3 className="font-drama text-xl md:text-2xl font-bold text-text lg:text-3xl leading-tight">
                {activeContent.content.title}
              </h3>
              <p className="text-text-muted leading-[1.8] text-sm md:text-base lg:text-lg">
                {activeContent.content.description}
              </p>
              <Button asChild className="group mt-2 md:mt-4 w-fit flex items-center justify-center gap-2 px-6 py-3 bg-accent hover:bg-accent-light text-white font-bold rounded-full transition-all duration-300 shadow-md hover:shadow-lg cursor-pointer btn-magnetic hover:text-white border-0">
                <Link href={activeContent.content.href}>
                  {activeContent.content.buttonText}
                  <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            {/* Image side — hidden on mobile, shown on lg+ */}
            <div className="relative w-full aspect-[4/3] overflow-hidden rounded-container shadow-xl hidden lg:block">
              <Image
                src={activeContent.content.imageSrc}
                alt={activeContent.content.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={90}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Tabs>
  );
}
