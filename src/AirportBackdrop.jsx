import React, {useEffect, useRef, useState} from 'react';

// Local media, loaded only near the viewport. Never competes with flight search.
export default function AirportBackdrop() {
  const host = useRef(null), video = useRef(null);
  const [near, setNear] = useState(false), [allowed, setAllowed] = useState(false);
  const [paused, setPaused] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const update = () => setAllowed(!motion.matches && !connection?.saveData);
    update(); motion.addEventListener('change', update);
    connection?.addEventListener?.('change', update);
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {rootMargin: '100px'});
    observer.observe(host.current);
    return () => {observer.disconnect(); motion.removeEventListener('change', update); connection?.removeEventListener?.('change', update);};
  }, []);
  useEffect(() => {
    const sync = () => {
      if (!video.current) return;
      if (near && allowed && !paused && !document.hidden) video.current.play().catch(() => setPaused(true));
      else video.current.pause();
    };
    sync(); document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [near, allowed, paused, failed]);
  return <div className="airport-backdrop" ref={host}>
    <img src={`${import.meta.env.BASE_URL}airport-background.jpg`} alt="" loading="lazy" aria-hidden="true" />
    {near && allowed && !failed && <video ref={video} src={`${import.meta.env.BASE_URL}airport-background.mp4`} muted loop playsInline preload="none" aria-hidden="true" onError={() => setFailed(true)} />}
    <div className="airport-backdrop-shade" />
    {allowed && !failed && <button className="airport-motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? 'Play background' : 'Pause background'}</button>}
  </div>;
}
