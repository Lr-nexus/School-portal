import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FiX, FiArrowRight, FiCheck } from 'react-icons/fi';

/**
 * Tours are defined per role. Each step:
 *   target — CSS selector (or null for a centered intro card)
 *   title  — heading
 *   body   — description
 *   position — 'right' | 'bottom' | 'top' | 'center'
 */
const TOURS = {
  student: [
    { target: null, title: 'Welcome to Bright Future 👋', body: "Let's take 60 seconds to show you around your portal." },
    { target: '.sidebar', title: 'Your navigation', body: 'Everything you need lives in this sidebar. Click any item to jump straight there.' },
    { target: '.welcome-banner', title: 'Your day at a glance', body: 'Attendance, average score, and fees are summarized right up top.' },
    { target: '.notif__btn', title: 'Stay updated', body: 'New grades, assignments, and announcements show up here instantly.' },
    { target: '.user-menu', title: "You're set!", body: 'Open your profile anytime to edit your details or change your password.' },
  ],
  teacher: [
    { target: null, title: 'Welcome, teacher 👋', body: 'A quick tour of your portal — under a minute.' },
    { target: '.sidebar', title: 'Your tools', body: 'Classroom, notes, assignments, and the gradebook are all one click away.' },
    { target: '.topbar__icon-btn', title: 'Try dark mode', body: 'Toggle theme anytime. Your choice is remembered.' },
    { target: '.welcome-banner', title: 'Your week', body: 'See your classes, students, and quizzes at a glance.' },
  ],
  parent: [
    { target: null, title: 'Welcome, guardian 👋', body: "Here's a quick tour of your child's portal." },
    { target: '.sidebar', title: 'Follow your child', body: 'Results, attendance, fees, and behaviour — all in the sidebar.' },
    { target: '.child-selector', title: 'Switch children', body: 'If you have more than one child, switch between them here.' },
    { target: '.welcome-banner', title: 'Everything at a glance', body: 'Attendance, average, and fees for the currently selected child.' },
  ],
  admin: [
    { target: null, title: 'Welcome, administrator 👋', body: 'A quick tour of the admin portal.' },
    { target: '.sidebar', title: 'Full control', body: 'People, academics, finance, communication, and system tools are all here.' },
    { target: '.welcome-banner', title: 'School pulse', body: 'Student count, teachers, quizzes, and announcements in one place.' },
  ],
};

export default function OnboardingTour({ role, onComplete }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const backdropRef = useRef(null);

  const tour = TOURS[role] || [];
  const current = tour[step];

  /* Measure the highlighted element on step change */
  useLayoutEffect(() => {
    if (!current) return;
    setReady(false);

    if (!current.target) {
      setRect(null);
      setReady(true);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      // Skip missing targets automatically
      if (step < tour.length - 1) setStep(step + 1);
      else onComplete();
      return;
    }

    const update = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
      setReady(true);
    };

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Wait a beat for scrolling to settle, then measure
    const t = setTimeout(update, 300);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line
  }, [step, current?.target]);

  /* Keyboard: Esc skips, → advances */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [step]);

  const next = () => {
    if (step < tour.length - 1) setStep(step + 1);
    else finish();
  };

  const finish = async () => {
    setBusy(true);
    try { await onComplete(); } finally { setBusy(false); }
  };

  if (!current || !ready) return null;

  /* Position the tooltip card */
  const tooltipStyle = (() => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const pad = 16;
    const cardWidth = 340;
    const cardHeight = 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pos = current.position || 'right';

    if (pos === 'right') {
      return {
        top: Math.min(Math.max(rect.top, 20), vh - cardHeight - 20),
        left: Math.min(rect.left + rect.width + pad, vw - cardWidth - 20),
      };
    }
    if (pos === 'bottom') {
      return {
        top: Math.min(rect.top + rect.height + pad, vh - cardHeight - 20),
        left: Math.min(Math.max(rect.left, 20), vw - cardWidth - 20),
      };
    }
    return {
      top: Math.max(rect.top - cardHeight - pad, 20),
      left: Math.min(Math.max(rect.left, 20), vw - cardWidth - 20),
    };
  })();

  return (
    <>
      {/* Dim + highlight ring */}
      <div className="tour-backdrop" ref={backdropRef} onClick={next} />
      {rect && (
        <div
          className="tour-highlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div className="tour-card" style={tooltipStyle}>
        <div className="tour-card__head">
          <span className="tour-card__step">
            Step {step + 1} of {tour.length}
          </span>
          <button
            className="tour-card__close"
            onClick={finish}
            title="Skip tour"
            disabled={busy}
          >
            <FiX size={14} />
          </button>
        </div>
        <h3 className="tour-card__title">{current.title}</h3>
        <p className="tour-card__body">{current.body}</p>
        <div className="tour-card__foot">
          <button
            className="btn btn--ghost btn--sm"
            onClick={finish}
            disabled={busy}
          >
            Skip
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={next}
            disabled={busy}
          >
            {step === tour.length - 1
              ? <><FiCheck size={14} /> Got it</>
              : <>Next <FiArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </>
  );
}