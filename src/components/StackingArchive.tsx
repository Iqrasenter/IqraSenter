'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// @ts-ignore — GSAP types casing mismatch on macOS
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, Observer, ScrollToPlugin);

export function StackingArchive({ children }: { children: React.ReactNode[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const currentIndexRef = useRef(0);
    const animatingRef = useRef(false);

    useEffect(() => {
        const cards = gsap.utils.toArray('.stacking-card') as HTMLElement[];
        if (cards.length === 0) return;

        // Store our card ScrollTriggers separately so we don't mix them up
        const cardTriggers: ScrollTrigger[] = [];
        const sectionPositions: number[] = [];

        const ctx = gsap.context(() => {
            // Step 1: Create ScrollTrigger timelines for stacking animation
            cards.forEach((card, i) => {
                if (i === cards.length - 1) return;
                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: card,
                        start: 'top top',
                        end: () => `+=${card.offsetHeight}`,
                        pin: true,
                        pinSpacing: false,
                        scrub: true,
                        invalidateOnRefresh: true,
                    }
                });

                // Store the trigger reference
                if (tl.scrollTrigger) {
                    cardTriggers.push(tl.scrollTrigger);
                }

                tl.to({}, { duration: 0.3 })
                    .to(card, {
                        scale: 0.9,
                        opacity: 0.5,
                        filter: 'blur(20px)',
                        pointerEvents: 'none',
                        ease: 'none',
                        duration: 0.7
                    });
            });

            // Step 2: Build section positions from our card triggers only
            ScrollTrigger.refresh();

            const buildPositions = () => {
                sectionPositions.length = 0;
                if (cardTriggers.length > 0) {
                    // Section 0 = first card's trigger start (first card fully visible)
                    sectionPositions.push(cardTriggers[0].start);
                    // Section 1..N-1 = each trigger's end (that card is covered, next is visible)
                    cardTriggers.forEach(st => {
                        sectionPositions.push(st.end);
                    });
                }
            };
            buildPositions();

            // Step 3: Navigation function
            const goToSection = (index: number) => {
                if (animatingRef.current) return;
                const clamped = gsap.utils.clamp(0, cards.length - 1, index);
                if (clamped === currentIndexRef.current) return;

                animatingRef.current = true;
                currentIndexRef.current = clamped;

                gsap.to(window, {
                    scrollTo: sectionPositions[clamped],
                    duration: 0.8,
                    ease: 'power2.inOut',
                    onComplete: () => {
                        animatingRef.current = false;
                    }
                });
            };

            // Step 4: Observer for hard page-lock (starts disabled)
            // onDown = user scrolls down = go to NEXT section
            // onUp = user scrolls up = go to PREVIOUS section
            const obs = Observer.create({
                type: 'wheel,touch',
                tolerance: 10,
                preventDefault: true,
                onDown: () => {
                    goToSection(currentIndexRef.current + 1);
                },
                onUp: () => {
                    // If at first section and scrolling up, scroll back to hero
                    if (currentIndexRef.current === 0) {
                        obs.disable();
                        animatingRef.current = true;
                        gsap.to(window, {
                            scrollTo: 0,
                            duration: 0.8,
                            ease: 'power2.inOut',
                            onComplete: () => {
                                animatingRef.current = false;
                            }
                        });
                        return;
                    }
                    goToSection(currentIndexRef.current - 1);
                },
            });
            // Start disabled — only enable when entering stacking area
            obs.disable();

            // Step 5: Enable observer when scrolling into the stacking area
            ScrollTrigger.create({
                trigger: containerRef.current,
                start: 'top top',
                end: 'bottom bottom',
                onEnter: () => {
                    obs.enable();
                    currentIndexRef.current = 0;
                    // Snap to the first section
                    if (!animatingRef.current) {
                        animatingRef.current = true;
                        gsap.to(window, {
                            scrollTo: sectionPositions[0],
                            duration: 0.6,
                            ease: 'power2.inOut',
                            onComplete: () => {
                                animatingRef.current = false;
                            }
                        });
                    }
                },
                onLeaveBack: () => {
                    obs.disable();
                    currentIndexRef.current = 0;
                },
            });

            // Step 6: Keyboard navigation
            const handleKeyDown = (e: KeyboardEvent) => {
                if (!obs.isEnabled) return;
                if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                    e.preventDefault();
                    goToSection(currentIndexRef.current + 1);
                } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                    e.preventDefault();
                    if (currentIndexRef.current === 0) {
                        obs.disable();
                        animatingRef.current = true;
                        gsap.to(window, {
                            scrollTo: 0,
                            duration: 0.8,
                            ease: 'power2.inOut',
                            onComplete: () => { animatingRef.current = false; }
                        });
                        return;
                    }
                    goToSection(currentIndexRef.current - 1);
                }
            };
            window.addEventListener('keydown', handleKeyDown);

            // Step 7: Rebuild positions on resize
            ScrollTrigger.addEventListener('refresh', buildPositions);

            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                ScrollTrigger.removeEventListener('refresh', buildPositions);
            };
        }, containerRef);

        return () => ctx.revert();
    }, [children]);

    return (
        <div ref={containerRef} className="relative w-full bg-bg">
            {React.Children.map(children, (child, index) => (
                <div
                    key={index}
                    className="stacking-card h-[calc(100dvh-var(--navbar-h))] w-full relative z-10 flex flex-col justify-center bg-bg pb-10 pt-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] rounded-t-[3rem]"
                    style={{ zIndex: index + 1 }}
                >
                    {child}
                </div>
            ))}
        </div>
    );
}
