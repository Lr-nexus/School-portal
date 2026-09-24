import { useEffect, useState } from 'react';
import { FiAlertCircle, FiClock } from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import WeeklyTimetable from '../../components/WeeklyTimetable';

export default function StudentTimetable() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await api('/students/me');
        const cls = profile.className;
        if (!cls) {
          setData({ className: null, slots: [] });
          return;
        }
        const res = await api(`/timetable/class/${encodeURIComponent(cls)}`);
        setData(res);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  if (loading) return <Loader />;

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Timetable" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }

  const hasSlots = (data?.slots?.length || 0) > 0;

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={
          data?.className
            ? `Weekly schedule for ${data.className}`
            : 'No class assigned'
        }
      />

      {!hasSlots && (
        <div className="card timetable-empty">
          <FiClock size={40} />
          <p>No timetable has been published for your class yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Your teacher will add it soon.
          </p>
        </div>
      )}

      {hasSlots && (
        <WeeklyTimetable className={data.className} slots={data.slots} />
      )}
    </div>
  );
}