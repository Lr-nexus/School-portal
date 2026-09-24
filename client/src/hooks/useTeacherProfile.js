import { useEffect, useState } from 'react';
import { api } from '../api/api';

/**
 * Fetches the logged-in teacher's profile.
 * Exposes:
 *   profile        — full teacher object (incl. teacherType, assignments)
 *   className      — form class if class teacher ('' otherwise)
 *   teacherType    — 'class_teacher' | 'subject_teacher'
 *   assignments    — [{ className, subject }] list of (class, subject) pairs
 *   targets        — alias for assignments (the pairs to post to)
 *   loading
 */
export function useTeacherProfile() {
  const [profile, setProfile] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api('/teachers/me'),
      api('/teachers/me/assignments').catch(() => []),
    ])
      .then(([p, pairs]) => {
        if (cancelled) return;
        setProfile(p);
        setTargets(Array.isArray(pairs) ? pairs : []);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return {
    profile,
    className: profile?.formClass || '',
    teacherType: profile?.teacherType || 'class_teacher',
    assignments: targets,
    targets,
    loading,
  };
}