import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff, FiUsers
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';

const SOCKET_URL = 'https://school-portal-unva.onrender.com';

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [myStream, setMyStream] = useState(null);
  // remotePeers is keyed by userId — stable across reconnects
  const [remotePeers, setRemotePeers] = useState({});
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('pending');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const myVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef({});      // keyed by socketId (WebRTC)
  const myStreamRef = useRef(null);
  const joinedRef = useRef(false);  // guard against double-join

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

  /* 4. Socket + peers */
  useEffect(() => {
    if (!myStream || !session) return;
    if (joinedRef.current) return; // prevents double-join if effect re-runs
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

    // People already in the room
    socket.on('existing-users', (users) => {
      users.forEach(({ socketId, userId, name, role }) => {
        if (userId === user.id) return; // skip self

        setRemotePeers((prev) => ({
          ...prev,
          [userId]: { name, role, socketId, stream: null }
        }));

        const peer = createPeer(socketId, userId, myStream, user.name);
        peersRef.current[socketId] = peer;
      });
    });

    // Someone new joined — just register them, wait for their signal
    socket.on('user-joined', ({ socketId, userId, name, role }) => {
      if (userId === user.id) return;

      setRemotePeers((prev) => ({
        ...prev,
        [userId]: { name, role, socketId, stream: null }
      }));
    });

    // Incoming signal
    socket.on('signal', ({ from, fromUserId, signal, name }) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = createResponderPeer(from, fromUserId, signal, myStream, name);
        peersRef.current[from] = peer;
      } else {
        peer.signal(signal);
      }
    });

    // Someone left — find their entry by socketId and remove it
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
      socketRef.current.emit('signal', {
        to: targetSocketId,
        signal,
        name: myName
      });
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
      socketRef.current.emit('signal', {
        to: targetSocketId,
        signal,
        name: user.name
      });
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
        <span className="pill pill--live">
          <FiUsers size={12} /> LIVE · {totalInRoom} in room
        </span>
      </header>

      <div className="video-grid">
        {/* Local */}
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

        {/* Remote — keyed by userId, so name/role always matches the tile */}
        {remoteList.map(([userId, peer]) => (
          <RemoteVideo
            key={userId}
            name={peer.name}
            role={peer.role}
            stream={peer.stream}
          />
        ))}

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

/* Remote tile — attach stream the moment the element exists */
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