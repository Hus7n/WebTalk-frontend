import { useRef, useEffect, useState, useCallback } from "react";
import { Phone, PhoneOff } from "lucide-react";

interface VoiceCallProps {
  ws: WebSocket;
  roomId: string;
  userId: string;
  username: string;
  onEndCall: () => void;
}

export default function VoiceCall({
  ws,
  roomId,
  userId,
  onEndCall,
}: VoiceCallProps) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<string | null>(null);

  const initLocalStream = useCallback(async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    }
  }, []);

  const startCall = useCallback(
    async (accepted = false) => {
      setInCall(true);
      await initLocalStream();

      if (!accepted) {
        ws.send(
          JSON.stringify({
            type: "call-offer",
            from: userId,
            roomId,
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "start-group-call",
            from: userId,
            roomId,
          })
        );
      }
    },
    [ws, userId, roomId, initLocalStream]
  );

  const createPeerConnection = useCallback(
    async (peerId: string, isInitiator: boolean) => {
      if (peerConnections.current.has(peerId)) return;

      //  STUN 
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
         
        ],
        iceCandidatePoolSize: 10,
      });

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        let audioEl = remoteAudioRef.current.get(peerId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          document.body.appendChild(audioEl);
          remoteAudioRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(
            JSON.stringify({
              type: "voice-candidate",
              candidate: event.candidate,
              from: userId,
              targetId: peerId, 
            })
          );
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed" || state === "disconnected" || state === "closed") {
          const audio = remoteAudioRef.current.get(peerId);
          if (audio) {
            audio.srcObject = null;
            audio.remove();
            remoteAudioRef.current.delete(peerId);
          }
          pc.close();
          peerConnections.current.delete(peerId);
        }
      };

      peerConnections.current.set(peerId, pc);

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({
            type: "voice-offer",
            offer,
            from: userId,
            targetId: peerId, 
          })
        );
      }
    },
    [ws, userId]
  );

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "call-offer" && data.from !== userId) {
        setIncomingCall(data.from);
      }

      if (data.type === "call-accept" && data.from !== userId) {
        await startCall(true);
      }

      if (data.type === "call-reject" && data.from !== userId) {
        alert(`${data.from} rejected the call.`);
        setInCall(false);
      }

      if (data.type === "voice-offer" && data.from !== userId) {
        await initLocalStream();
        await createPeerConnection(data.from, false);

        await peerConnections.current
          .get(data.from)
          ?.setRemoteDescription(new RTCSessionDescription(data.offer));

        const answer = await peerConnections.current.get(data.from)?.createAnswer();
        await peerConnections.current.get(data.from)?.setLocalDescription(answer);

        ws.send(
          JSON.stringify({
            type: "voice-answer",
            answer,
            from: userId,
            targetId: data.from, 
          })
        );
        setInCall(true);
      } else if (data.type === "voice-answer" && data.from !== userId) {
        await peerConnections.current
          .get(data.from)
          ?.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.type === "voice-candidate" && data.from !== userId) {
        await peerConnections.current
          .get(data.from)
          ?.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else if (data.type === "user-left-call" && data.from !== userId) {
        const pc = peerConnections.current.get(data.from);
        pc?.close();
        peerConnections.current.delete(data.from);

        const audio = remoteAudioRef.current.get(data.from);
        if (audio) {
          audio.srcObject = null;
          audio.remove();
          remoteAudioRef.current.delete(data.from);
        }
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, userId, createPeerConnection, startCall, initLocalStream]);

  const acceptCall = () => {
    ws.send(
      JSON.stringify({
        type: "call-accept",
        from: userId,
        roomId,
      })
    );
    setIncomingCall(null);
  };

  const rejectCall = () => {
    ws.send(
      JSON.stringify({
        type: "call-reject",
        from: userId,
        roomId,
      })
    );
    setIncomingCall(null);
  };

  const leaveCall = () => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    remoteAudioRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    setInCall(false);
    ws.send(JSON.stringify({ type: "user-left-call", from: userId }));
    onEndCall();
  };

  return (
    <div className="relative mt-2">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-50">
          <div className="bg-zinc-900/80 rounded-2xl shadow-2xl p-6 w-80 border border-white/10 text-center">
            <h2 className="text-lg font-bold text-white mb-2">Incoming Call</h2>
            <p className="text-sm text-zinc-300 mb-6">{incomingCall} is calling you...</p>
            <div className="flex justify-center gap-4">
              <button
                className="px-5 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center gap-2"
                onClick={acceptCall}
              >
                <Phone size={18} /> Accept
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2"
                onClick={rejectCall}
              >
                <PhoneOff size={18} /> Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Control Buttons */}
      {!inCall ? (
        <button
          onClick={() => startCall(false)}
          className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 h-10 rounded-md border border-zinc-700 transition"
        >
          Start Call
        </button>
      ) : (
        <button
          onClick={leaveCall}
          className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-md cursor-pointer transition"
        >
          Leave Call
        </button>
      )}
    </div>
  );
}
