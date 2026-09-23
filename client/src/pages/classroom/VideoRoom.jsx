import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, FiUsers,
  FiAlertCircle
} from 'react-icons/fi';
import { FaHandPaper } from 'react-icons/fa';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';

/* Force the deployed backend URL — no localhost */
const SOCKET_URL =
  (process.env.REACT_APP_API_URL || 'https://school-portal-unva.onrender.com/api')
    .replace(/\/api\/?$/, '');

/* Public STUN servers so peers behind NAT can find each other */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({});
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('pending');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
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

    console.log('🔌 connecting to socket at', SOCKET_URL);
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ socket connected:', socket.id);
      setSocketStatus('connected');
      socket.emit(
        'join-room',
        {
          roomId: session.roomId,
          userId: user.id,
          name: user.name,
          role: user.role,
        },
        (ack) => {
          console.log('📥 join-room ack:', ack);
        }
      );
    });

    socket.on('connect_error', (err) => {
      console.error('❌ socket connect_error:', err.message);
      setSocketStatus('error');
      setError(`Could not connect to classroom: ${err.message}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ socket disconnected:', reason);
      setSocketStatus('disconnected');
    });

    /* --- existing users → initiate peers to them --- */
    socket.on('existing-users', (users) => {
      console.log('👥 existing users:', users);
      users.forEach(({ socketId, userId, name, role }) => {
        if (userId === user.id) return;

        setRemotePeers((prev) => ({
          ...prev,
          [userId]: { name, role, socketId, stream: null },
        }));

        const peer = createPeer(socketId, userId, myStream, user.name);
        peersRef.current[socketId] = peer;
      });
    });

    /* --- someone else joined → wait for their signal --- */
    socket.on('user-joined', ({ socketId, userId, name, role }) => {
      console.log('👋 user joined:', name, socketId);
      if (userId === user.id) return;

      setRemotePeers((prev) => ({
        ...prev,
        [userId]: { name, role, socketId, stream: null },
      }));
    });

    /* --- incoming signal --- */
    socket.on('signal', ({ from, fromUserId, signal, name }) => {
      console.log('🔀 signal from', name, from);
      let peer = peersRef.current[from];
      if (!peer) {
        peer = createResponderPeer(from, fromUserId, signal, myStream, name);
        peersRef.current[from] = peer;
      } else {
        try {
          peer.signal(signal);
        } catch (err) {
          console.error('peer.signal error:', err);
        }
      }
    });

    /* --- someone left --- */
    socket.on('user-left', (socketId) => {
      console.log('🚪 user-left:', socketId);
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
    console.log('🔧 createPeer (initiator) →', targetSocketId);

    const peer = new Peer({
      initiator: true,
      trickle: false,
      config: { iceServers: ICE_SERVERS },
      stream,
    });

    peer.on('signal', (signal) => {
      console.log('📤 emitting signal to', targetSocketId);
      socketRef.current.emit('signal', {
        to: targetSocketId,
        signal,
        name: myName,
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('🎥 got remote stream from', targetSocketId);
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return {
          ...prev,
          [targetUserId]: { ...prev[targetUserId], stream: remoteStream },
        };
      });
    });

    peer.on('connect', () => console.log('🔗 peer connected:', targetSocketId));
    peer.on('error', (e) => console.error('peer error:', e));
    peer.on('close', () => removePeerBySocket(targetSocketId));

    return peer;
  };

  const createResponderPeer = (targetSocketId, targetUserId, incomingSignal, stream, name) => {
    console.log('🔧 createPeer (responder) →', targetSocketId);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      config: { iceServers: ICE_SERVERS },
      stream,
    });

    peer.on('signal', (signal) => {
      console.log('📤 responder emitting signal to', targetSocketId);
      socketRef.current.emit('signal', {
        to: targetSocketId,
        signal,
        name: user.name,
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('🎥 responder got remote stream from', targetSocketId);
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return {
          ...prev,
          [targetUserId]: { ...prev[targetUserId], stream: remoteStream },
        };
      });
    });

    peer.on('connect', () => console.log('🔗 responder peer connected:', targetSocketId));
    peer.on('error', (e) => console.error('responder peer error:', e));
    peer.on('close', () => removePeerBySocket(targetSocketId));

    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.error('responder signal error:', err);
    }

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
    const next = !handRaised;
    setHandRaised(next);
    if (socketRef.current) {
      socketRef.current.emit('raise-hand', {
        roomId: session?.roomId,
        raised: next,
        name: user.name,
      });
    }
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
  const totalInRoom = remoteList.length + 1;

  /* ---------- Error screen ---------- */
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

  /* ---------- Loading screen ---------- */
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
      <header className="video-room__header">
        <div>
          <h2>{session.title}</h2>
          <p>
            {session.subject} · {session.className} · Teacher:{' '}
            {session.teacherName || session.teacher_name}
          </p>
        </div>
        <div className="video-room__header-right">
          {socketStatus !== 'connected' && (
            <span
              className="pill"
              style={{ background: 'rgba(220,38,38,.2)', color: '#fca5a5' }}
            >
              <FiAlertCircle size={12} /> {socketStatus}
            </span>
          )}
          {handRaised && (
            <span className="pill pill--hands">
              <FaHandPaper size={12} /> Hand raised
            </span>
          )}
          <span className="pill pill--live">
            <FiUsers size={12} /> LIVE · {totalInRoom} in room
          </span>
        </div>
      </header>

      <div className="video-grid">
        {/* Local video */}
        <div className="video-tile video-tile--local">
          <video
            ref={(el) => {
              myVideoRef.current = el;
              if (el && myStreamRef.current) {
                el.srcObject = myStreamRef.current;
              }
            }}
            autoPlay
            playsInline
            muted
          />
          <div className="video-tile__label">
            You ({user.name}) · {user.role}
          </div>
          {!camOn && <div className="video-tile__off">Camera off</div>}
        </div>

        {/* Remote videos */}
        {remoteList.map(([userId, peer]) => (
          <RemoteVideo
            key={userId}
            name={peer.name}
            role={peer.role}
            stream={peer.stream}
          />
        ))}

        {/* Empty state */}
        {remoteList.length === 0 && (
          <div className="video-tile video-tile--waiting">
            <div className="video-tile__waiting-text">
              <div className="spinner" />
              <p>Waiting for others to join…</p>
              <small>
                Share the class link, or ask students to open their Classroom page.
              </small>
            </div>
          </div>
        )}
      </div>

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

        <button
          className={`video-controls__btn ${
            handRaised ? 'video-controls__btn--hand-active' : ''
          }`}
          onClick={toggleHand}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <FaHandPaper size={20} />
        </button>

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
function RemoteVideo({ name, role, stream }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-tile">
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
      {!stream && <div className="video-tile__off">Connecting…</div>}
    </div>
  );
}