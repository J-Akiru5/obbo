'use client';

import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed right-6 bottom-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0c1a2b]/80 text-white/50 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:text-white/90"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
