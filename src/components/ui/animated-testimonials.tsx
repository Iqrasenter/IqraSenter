"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Testimonial = {
  quote: string;
  name: string;
  designation: string;
  src: string;
};

export const AnimatedTestimonials = ({
  testimonials,
  autoplay = false,
  className,
}: {
  testimonials: Testimonial[];
  autoplay?: boolean;
  className?: string;
}) => {
  const [active, setActive] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const handleNext = () => {
    setActive((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleUserNext = () => {
    handleNext();
    setResetKey((k) => k + 1);
  };

  const handleUserPrev = () => {
    handlePrev();
    setResetKey((k) => k + 1);
  };

  const isActive = (index: number) => {
    return index === active;
  };

  useEffect(() => {
    if (autoplay) {
      const interval = setInterval(handleNext, 5000);
      return () => clearInterval(interval);
    }
  }, [autoplay, resetKey]);

  const randomRotateY = () => {
    return Math.floor(Math.random() * 21) - 10;
  };

  return (
    <div
      className={cn(
        "max-w-sm md:max-w-6xl mx-auto px-4 md:px-8 lg:px-12",
        className
      )}
    >
      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6 md:gap-20 lg:gap-32">
        {/* Image — shows ABOVE text on mobile (order-1), right side on desktop (order-2) */}
        <div className="order-1 md:order-2">
          <div className="relative h-48 sm:h-56 md:h-[450px] w-full">
            <AnimatePresence>
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.src}
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    z: -100,
                    rotate: randomRotateY(),
                  }}
                  animate={{
                    opacity: isActive(index) ? 1 : 0.7,
                    scale: isActive(index) ? 1 : 0.95,
                    z: isActive(index) ? 0 : -100,
                    rotate: isActive(index) ? 0 : randomRotateY(),
                    zIndex: isActive(index)
                      ? 999
                      : testimonials.length + 2 - index,
                    y: isActive(index) ? [0, -80, 0] : 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    z: 100,
                    rotate: randomRotateY(),
                  }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 origin-bottom"
                >
                  <Image
                    src={testimonial.src}
                    alt={testimonial.name}
                    width={500}
                    height={500}
                    draggable={false}
                    className="h-full w-full rounded-3xl object-contain object-center"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Text — shows BELOW image on mobile (order-2), left side on desktop (order-1) */}
        <div className="flex justify-between flex-col py-2 md:py-4 order-2 md:order-1">
          <motion.div
            key={active}
            initial={{
              y: 20,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: -20,
              opacity: 0,
            }}
            transition={{
              duration: 0.2,
              ease: "easeInOut",
            }}
          >
            <h3 className="text-xl md:text-2xl font-bold text-text">
              {testimonials[active].name}
            </h3>
            <p className="text-xs md:text-sm text-text-muted">
              {testimonials[active].designation}
            </p>
            <motion.p className="text-sm md:text-lg text-text-muted mt-4 md:mt-8">
              {testimonials[active].quote.split(" ").map((word, index) => (
                <motion.span
                  key={index}
                  initial={{
                    filter: "blur(10px)",
                    opacity: 0,
                    y: 5,
                  }}
                  animate={{
                    filter: "blur(0px)",
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.2,
                    ease: "easeInOut",
                    delay: 0.02 * index,
                  }}
                  className="inline-block"
                >
                  {word}&nbsp;
                </motion.span>
              ))}
            </motion.p>
          </motion.div>
          <div className="flex gap-4 pt-6 md:pt-0">
            <button
              onClick={handleUserPrev}
              className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center cursor-pointer btn-magnetic hover:bg-accent hover:text-white transition-colors text-accent shadow-sm"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleUserNext}
              className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center cursor-pointer btn-magnetic hover:bg-accent hover:text-white transition-colors text-accent shadow-sm"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
