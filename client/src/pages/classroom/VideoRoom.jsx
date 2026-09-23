import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiUsers, FiAlertCircle, FiX
} from 'react-icons/fi';
import { FaHandPaper } from 'react-icons/fa';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';

const SOCKET_URL =
  (process.env.REACT_APP_API_URL || 'https://school-portal-1-xaio.onrender.com/api')
    .replace(/\/api\/?$/, '');

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const isAdmin   = user?.role === 'admin';

  const [session, setSession] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({});
  const [raisedHands, setRaisedHands] = useState({}); // { socketId: { name, userId } }
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('pending');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [socketStatus, setSocketStatus] = useState('connecting');

  const myVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const myStreamRef = useRef(null);
  const joinedRef = useRef(false);

  /* ---------- 1. Verify room ---------- */
  useEffect(() => {
    api(`/classroom/rooms/${roomId}`)
      .then(setSession)
      .catch((e) => setError(e.message));
  }, [roomId]);

  /* ---------- 2. Get camera + mic ---------- */
  useEffect(() => {
    let cancelled = false;

    async function getMedia() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Your browser does not support camera access.');
        setPermission('denied');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        myStreamRef.current = stream;
        setMyStream(stream);
        setPermission('granted');
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      } catch (err) {
        let msg = 'Could not access camera/microphone.';
        if (err.name === 'NotAllowedError') {
          msg = 'Permission was denied. Click the camera icon in your browser bar, allow access, then reload.';
        } else if (err.name === 'NotFoundError') {
          msg = 'No camera or microphone found on this device.';
        }
        setError(msg);
        setPermission('denied');
      }
    }

    getMedia();
    return () => { cancelled = true; };
  }, []);

  /* ---------- 3. Local video attach ---------- */
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream, permission, session]);

  /* ---------- 4. Socket + peers ---------- */
  useEffect(() => {
    if (!myStream || !session) return;
    if (joinedRef.current) return;
    joinedRef.current = true;

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit(
        'join-room',
        {
          roomId: session.roomId,
          userId: user.id,
          name: user.name,
          role: user.role,
        },
        (ack) => console.log('join-room ack:', ack)
      );
    });

    socket.on('connect_error', (err) => {
      setSocketStatus('error');
      setError(`Could not connect to classroom: ${err.message}`);
    });

    socket.on('disconnect', () => setSocketStatus('disconnected'));

    /* --- existing users --- */
    socket.on('existing-users', (users) => {
      users.forEach(({ socketId, userId, name, role }) => {
        if (userId === user.id) return;
        setRemotePeers((prev) => ({
          ...prev,
          [userId]: { name, role, socketId, stream: null }
        }));
        const peer = createPeer(socketId, userId, myStream, user.name);
        peersRef.current[socketId] = peer;
      });
    });

    /* --- someone joined --- */
    socket.on('user-joined', ({ socketId, userId, name, role }) => {
      if (userId === user.id) return;
      setRemotePeers((prev) => ({
        ...prev,
        [userId]: { name, role, socketId, stream: null }
      }));
    });

    /* --- incoming signal --- */
    socket.on('signal', ({ from, fromUserId, signal, name }) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = createResponderPeer(from, fromUserId, signal, myStream, name);
        peersRef.current[from] = peer;
      } else {
        try { peer.signal(signal); } catch (err) { console.error(err); }
      }
    });

    /* --- someone left --- */
    socket.on('user-left', (socketId) => {
      peersRef.current[socketId]?.destroy();
      delete peersRef.current[socketId];
      setRemotePeers((prev) => {
        const copy = { ...prev };
        for (const uid of Object.keys(copy)) {
          if (copy[uid].socketId === socketId) {
            delete copy[uid];
            break;
          }
        }
        return copy;
      });
      setRaisedHands((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    });

    /* --- hand raised / lowered --- */
    socket.on('hand-raised', ({ socketId, userId, name, raised }) => {
      setRaisedHands((prev) => {
        const copy = { ...prev };
        if (raised) copy[socketId] = { name, userId };
        else delete copy[socketId];
        return copy;
      });
    });

    return () => {
      joinedRef.current = false;
      socket.disconnect();
      Object.values(peersRef.current).forEach((p) => {
        try { p.destroy(); } catch {}
      });
      peersRef.current = {};
    };
    // eslint-disable-next-line
  }, [myStream, session]);

  /* ---------- Peer factories ---------- */
  const createPeer = (targetSocketId, targetUserId, stream, myName) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      config: { iceServers: ICE_SERVERS },
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('signal', { to: targetSocketId, signal, name: myName });
    });

    peer.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return { ...prev, [targetUserId]: { ...prev[targetUserId], stream: remoteStream } };
      });
    });

    peer.on('error', (e) => console.error('peer error:', e));
    peer.on('close', () => removePeerBySocket(targetSocketId));
    return peer;
  };

  const createResponderPeer = (targetSocketId, targetUserId, incomingSignal, stream, name) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      config: { iceServers: ICE_SERVERS },
      stream,
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('signal', { to: targetSocketId, signal, name: user.name });
    });

    peer.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return { ...prev, [targetUserId]: { ...prev[targetUserId], stream: remoteStream } };
      });
    });

    peer.on('error', (e) => console.error('responder peer error:', e));
    peer.on('close', () => removePeerBySocket(targetSocketId));

    try { peer.signal(incomingSignal); } catch (err) { console.error(err); }
    return peer;
  };

  const removePeerBySocket = (socketId) => {
    delete peersRef.current[socketId];
    setRemotePeers((prev) => {
      const copy = { ...prev };
      for (const uid of Object.keys(copy)) {
        if (copy[uid].socketId === socketId) {
          delete copy[uid];
          break;
        }
      }
      return copy;
    });
  };

  /* ---------- Controls ---------- */
  const toggleMic = () => {
    if (!myStream) return;
    myStream.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    if (!myStream) return;
    myStream.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const toggleHand = () => {
    const next = !myHandRaised;
    setMyHandRaised(next);
    socketRef.current?.emit('raise-hand', {
      roomId: session?.roomId,
      raised: next,
    });
  };

  const lowerStudentHand = (socketId) => {
    if (!isTeacher) return;
    socketRef.current?.emit('lower-hand', {
      roomId: session?.roomId,
      socketId,
    });
  };

  const leaveRoom = () => {
    myStream?.getTracks().forEach((t) => t.stop());
    socketRef.current?.disconnect();
    Object.values(peersRef.current).forEach((p) => {
      try { p.destroy(); } catch {}
    });
    peersRef.current = {};
    setRemotePeers({});
    navigate(-1);
  };

  const remoteList = Object.entries(remotePeers);
  const raisedList = Object.entries(raisedHands);
  const totalInRoom = remoteList.length + 1;

  /* ---------- Error ---------- */
  if (error) {
    return (
      <div className="video-room video-room--error">
        <div className="video-room__error-card">
          <h2>Cannot join the classroom</h2>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Loading ---------- */
  if (permission === 'pending' || !session) {
    return (
      <div className="video-room video-room--loading">
        <div className="video-room__loader">
          <div className="spinner" />
          <h2>Connecting…</h2>
          <p>Please allow camera and microphone access when your browser asks.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room">
      {/* ================= HEADER ================= */}
      <header className="video-room__header">
        <div className="video-room__header-left">
          <h2>{session.title}</h2>
          <p>
            {session.subject} · {session.className} · Teacher:{' '}
            {session.teacherName || session.teacher_name}
          </p>
        </div>
        <div className="video-room__header-right">
          {socketStatus !== 'connected' && (
            <span className="pill pill--danger">
              <FiAlertCircle size={12} /> {socketStatus}
            </span>
          )}
          <span className="pill pill--live">
            <FiUsers size={12} /> LIVE · {totalInRoom}
          </span>
        </div>
      </header>

      {/* ================= RAISED HANDS BAR ================= */}
      {raisedList.length > 0 && (
        <div className="raised-hands-bar">
          <span className="raised-hands-bar__label">
            <FaHandPaper size={14} />
            {raisedList.length} hand{raisedList.length === 1 ? '' : 's'} raised
          </span>
          <div className="raised-hands-bar__chips">
            {raisedList.map(([socketId, info]) => (
              <button
                key={socketId}
                type="button"
                className="raised-hands-bar__chip"
                onClick={() => isTeacher && lowerStudentHand(socketId)}
                title={isTeacher ? 'Click to dismiss' : info.name}
                disabled={!isTeacher}
              >
                <FaHandPaper size={12} />
                <span>{info.name}</span>
                {isTeacher && <FiX size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= VIDEO GRID ================= */}
      <div className="video-grid">
        {/* Local */}
        <div
          className={`video-tile video-tile--local ${
            myHandRaised ? 'video-tile--hand' : ''
          }`}
        >
          <video
            ref={(el) => {
              myVideoRef.current = el;
              if (el && myStreamRef.current) el.srcObject = myStreamRef.current;
            }}
            autoPlay
            playsInline
            muted
          />
          <div className="video-tile__label">
            You ({user.name}) · {user.role}
          </div>
          {myHandRaised && (
            <div className="video-tile__hand-badge">
              <FaHandPaper size={11} /> You
            </div>
          )}
          {!camOn && <div className="video-tile__off">Camera off</div>}
        </div>

        {/* Remote */}
        {remoteList.map(([userId, peer]) => (
          <RemoteVideo
            key={userId}
            name={peer.name}
            role={peer.role}
            stream={peer.stream}
            handRaised={!!raisedHands[peer.socketId]}
          />
        ))}

        {/* Empty state */}
        {remoteList.length === 0 && (
          <div className="video-tile video-tile--waiting">
            <div className="video-tile__waiting-text">
              <div className="spinner" />
              <p>Waiting for others to join…</p>
              <small>Others will appear here as they join the class.</small>
            </div>
          </div>
        )}
      </div>

      {/* ================= CONTROLS ================= */}
      <div className="video-controls">
        <button
          className={`video-controls__btn ${micOn ? '' : 'video-controls__btn--off'}`}
          onClick={toggleMic}
          title={micOn ? 'Mute' : 'Unmute'}
        >
          {micOn ? <FiMic size={20} /> : <FiMicOff size={20} />}
        </button>

        <button
          className={`video-controls__btn ${camOn ? '' : 'video-controls__btn--off'}`}
          onClick={toggleCam}
          title={camOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {camOn ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
        </button>

        {/* Hand raise — ONLY for students */}
        {isStudent && (
          <button
            className={`video-controls__btn ${
              myHandRaised ? 'video-controls__btn--hand-active' : ''
            }`}
            onClick={toggleHand}
            title={myHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <FaHandPaper size={20} />
          </button>
        )}

        <button
          className="video-controls__btn video-controls__btn--end"
          onClick={leaveRoom}
          title="Leave"
        >
          <FiPhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

/* ---- Remote tile ---- */
function RemoteVideo({ name, role, stream, handRaised }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`video-tile ${handRaised ? 'video-tile--hand' : ''}`}>
      <video
        ref={(el) => {
          ref.current = el;
          if (el && stream) el.srcObject = stream;
        }}
        autoPlay
        playsInline
      />
      <div className="video-tile__label">
        {name} · {role}
      </div>
      {handRaised && (
        <div className="video-tile__hand-badge">
          <FaHandPaper size={11} /> Hand raised
        </div>
      )}
      {!stream && <div className="video-tile__off">Connecting…</div>}
    </div>
  );
}