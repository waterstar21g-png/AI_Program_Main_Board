'use client';

import { useEffect } from 'react';

/** 터치·PWA standalone 등 모바일 환경에 맞는 html 클래스 부여 */
export function MobileEnv({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      root.classList.add('is-touch');
    }

    const nav = navigator as Navigator & { standalone?: boolean };
    const applyStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
      root.classList.toggle('is-standalone', standalone);
    };
    applyStandalone();

    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', applyStandalone);

    return () => mq.removeEventListener('change', applyStandalone);
  }, []);

  return children;
}
