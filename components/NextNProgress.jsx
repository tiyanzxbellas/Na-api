'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

function NProgressDone() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  return null;
}

export default function NextNProgress() {
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
  }, []);

  useEffect(() => {
    const handleAnchorClick = (event) => {
      const anchor = event.target.closest('a');
      if (
        anchor && 
        anchor.href && 
        anchor.target !== '_blank' && 
        !anchor.href.includes('#') &&
        anchor.href.startsWith(window.location.origin)
      ) {
        if (anchor.href !== window.location.href) {
          NProgress.start();
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <>
      <div className="lightning-loader">
        <div className="lightning-trail"></div>
        <i className="fas fa-bolt lightning-icon"></i>
      </div>
      <Suspense fallback={null}>
        <NProgressDone />
      </Suspense>
    </>
  );
}