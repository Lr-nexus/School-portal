import { useEffect, useState } from 'react';
import { api } from '../api/api';

/**
 * Fetches the logged-in teacher's profile.
 * Exposes `className` = the teacher's form class (or '' if unassigned).
 */
export function useTeacherProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api('/teachers/me')
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const className = profile?.formClass || '';

  return { profile, className, loading };
}