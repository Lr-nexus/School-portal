import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff,
  FiPhoneOff, FiUsers, FiAlertCircle,
  FiCheckCircle
} from 'react-icons/fi';
import { FaHandPaper } from 'react-icons/fa';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';

const SOCKET_URL = 'https://school-portal-unva.onrender.com';

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

  const [myHandRaised, setMyHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState([]);
  const [toast, setToast] = useState(null);

  const myVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const myStreamRef = useRef(null);
  const joinedRef = useRef(false);

  /* 1. Verify room */
  useEffect(() => {
    api(`/classroom/rooms/${roomId}`)
      .then(setSession)
      .catch((e) => setError(e.message));
  }, [roomId]);

  /* 2. Get media */
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
          audio: true
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

  /* 3. Local video attach */
  useEffect(() => {
    if (myVideoRef.current && myStream) {
      myVideoRef.current.srcObject = myStream;
    }
  }, [myStream, permission, session]);

  useEffect(() => {
    if (!myStream || !session) return;
    if (joinedRef.current) return;
    joinedRef.current = true;

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', {
        roomId: session.roomId,
        userId: user.id,
        name: user.name,
        role: user.role
      });
    });

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

    socket.on('user-joined', ({ socketId, userId, name, role }) => {
      if (userId === user.id) return;
      setRemotePeers((prev) => ({
        ...prev,
        [userId]: { name, role, socketId, stream: null }
      }));
    });

    socket.on('signal', ({ from, fromUserId, signal, name }) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = createResponderPeer(from, fromUserId, signal, myStream, name);
        peersRef.current[from] = peer;
      } else {
        peer.signal(signal);
      }
    });

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
      setRaisedHands((prev) => prev.filter((h) => h.socketId !== socketId));
    });

    /* ---------- RAISE HAND EVENTS ---------- */
    socket.on('raised-hands-list', (list) => {
      const enriched = list.map((sid) => ({ socketId: sid }));
      setRaisedHands(enriched);
    });

    socket.on('hand-raised', (data) => {
      setRaisedHands((prev) => {
        if (prev.some((h) => h.socketId === data.socketId)) return prev;
        return [...prev, data];
      });
      if (user.role === 'teacher' || user.role === 'admin') {
        setToast({ type: 'hand', text: `${data.name} raised their hand` });
        setTimeout(() => setToast(null), 3500);
      }
    });

    socket.on('hand-lowered', ({ socketId }) => {
      setRaisedHands((prev) => prev.filter((h) => h.socketId !== socketId));
      if (socketId === socketRef.current?.id) {
        setMyHandRaised(false);
      }
    });

    socket.on('hand-acknowledged', ({ byName }) => {
      setMyHandRaised(false);
      setToast({ type: 'ack', text: `${byName} acknowledged your hand` });
      setTimeout(() => setToast(null), 3000);
    });

    return () => {
      joinedRef.current = false;
      socket.disconnect();
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
    };
    // eslint-disable-next-line
  }, [myStream, session]);

  /* Peer factories */
  const createPeer = (targetSocketId, targetUserId, stream, myName) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });

    peer.on('signal', (signal) => {
      socketRef.current.emit('signal', { to: targetSocketId, signal, name: myName });
    });

    peer.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return {
          ...prev,
          [targetUserId]: { ...prev[targetUserId], stream: remoteStream }
        };
      });
    });

    peer.on('close', () => removePeerBySocket(targetSocketId));
    peer.on('error', (e) => console.error('peer error', e));
    return peer;
  };

  const createResponderPeer = (targetSocketId, targetUserId, incomingSignal, stream, name) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });

    peer.on('signal', (signal) => {
      socketRef.current.emit('signal', { to: targetSocketId, signal, name: user.name });
    });

    peer.on('stream', (remoteStream) => {
      setRemotePeers((prev) => {
        if (!prev[targetUserId]) return prev;
        return {
          ...prev,
          [targetUserId]: { ...prev[targetUserId], stream: remoteStream }
        };
      });
    });

    peer.on('close', () => removePeerBySocket(targetSocketId));
    peer.on('error', (e) => console.error('peer error', e));
    peer.signal(incomingSignal);
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

  /* Controls */
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

  const toggleRaiseHand = () => {
    if (!socketRef.current) return;
    if (myHandRaised) {
      socketRef.current.emit('lower-hand');
      setMyHandRaised(false);
    } else {
      socketRef.current.emit('raise-hand');
      setMyHandRaised(true);
    }
  };

  const acknowledgeHand = (socketId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('acknowledge-hand', { socketId });
  };

  const leaveRoom = () => {
    myStream?.getTracks().forEach((t) => t.stop());
    socketRef.current?.disconnect();
    Object.values(peersRef.current).forEach((p) => p.destroy());
    peersRef.current = {};
    setRemotePeers({});
    navigate(-1);
  };

  const remoteList = Object.entries(remotePeers);
  const totalInRoom = remoteList.length + 1;
  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  /* Error screen */
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

  /* Loading */
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
          <p>{session.subject} · {session.className} · Teacher: {session.teacherName}</p>
        </div>
        <div className="video-room__header-right">
          {raisedHands.length > 0 && (
            <span className="pill pill--hands">
              <FaHandPaper size={12} />
              {raisedHands.length} hand{raisedHands.length > 1 ? 's' : ''} raised
            </span>
          )}
          <span className="pill pill--live">
            <FiUsers size={12} /> LIVE · {totalInRoom} in room
          </span>
        </div>
      </header>

      {toast && (
        <div className="video-toast">
          {toast.type === 'ack'
            ? <FiCheckCircle size={16} />
            : <FiAlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      {isTeacher && raisedHands.length > 0 && (
        <div className="raised-hands-bar">
          <span className="raised-hands-bar__label">
            <FaHandPaper size={13} /> Raised hands:
          </span>
          {raisedHands.map((h) => (
            <button
              key={h.socketId}
              className="raised-hands-bar__chip"
              onClick={() => acknowledgeHand(h.socketId)}
              title="Click to acknowledge"
            >
              <FaHandPaper size={11} /> {h.name || 'Student'}
            </button>
          ))}
        </div>
      )}

      <div className="video-grid">
        <div className={`video-tile video-tile--local ${myHandRaised ? 'video-tile--hand' : ''}`}>
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
          {myHandRaised && (
            <div className="video-tile__hand-badge">
              <FaHandPaper size={11} /> Hand raised
            </div>
          )}
          {!camOn && <div className="video-tile__off">Camera off</div>}
        </div>

        {remoteList.map(([userId, peer]) => {
          const peerHandRaised = raisedHands.some(
            (h) => h.name === peer.name && h.role !== 'teacher'
          );
          return (
            <RemoteVideo
              key={userId}
              name={peer.name}
              role={peer.role}
              stream={peer.stream}
              handRaised={peerHandRaised}
            />
          );
        })}

        {remoteList.length === 0 && (
          <div className="video-tile video-tile--waiting">
            <div className="video-tile__waiting-text">
              <div className="spinner" />
              <p>Waiting for others to join…</p>
              <small>Ask others to open their Classroom page and join.</small>
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

        {!isTeacher && (
          <button
            className={`video-controls__btn ${myHandRaised ? 'video-controls__btn--hand-active' : ''}`}
            onClick={toggleRaiseHand}
            title={myHandRaised ? 'Lower your hand' : 'Raise your hand'}
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

/* Remote tile */
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