// App.tsx
import { useEffect, useState, useRef } from "react";
import "./App.css";
import Audio from "./Audio";

interface ChatMessage {
  senderId: string;
  message?: string;
  audio?: string; // base64 URL
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [myId, setMyId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [step, setStep] = useState<"choose" | "create" | "join" | "chat">("choose");
  const [userCount, setUserCount] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const myIdRef = useRef<string | null>(null);

  const [pendingAudio, setPendingAudio] = useState<string | null>(null);

  // 🔽 Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔽 WebSocket
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      console.error("WebSocket URL not found");
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (roomId) {
        ws.send(JSON.stringify({ type: "join", payload: { roomId } }));
      }
    };

      const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "id") {
        setMyId(data.payload.senderId);
        myIdRef.current = data.payload.senderId;
      }

      if (data.type === "chat") {
        // Ignore echoed messages from self; we already added them optimistically
        if (data.payload.senderId === myIdRef.current) return;
        setMessages((prev) => [
          ...prev,
          { senderId: data.payload.senderId, message: data.payload.message },
        ]);
      }

      if (data.type === "audio-message") {
        // Ignore echoed audio from self; we already added it optimistically
        if (data.payload.senderId === myIdRef.current) return;
        setMessages((prev) => [
          ...prev,
          { senderId: data.payload.senderId, audio: data.payload.audio },
        ]);
      }

      if (data.type === "userCount") setUserCount(data.payload.count);
    };

    ws.addEventListener("message", handleMessage);

    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.close();
    };
  }, [roomId, step]);

  // 🔽 Send text or audio
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // stop form double submit
    if (!wsRef.current) return;

    // 🎤 Audio first
    if (pendingAudio) {
      wsRef.current.send(
        JSON.stringify({
          type: "audio-message",
          payload: { senderId: myId, roomId, audio: pendingAudio },
        })
      );
      setMessages((prev) => [...prev, { senderId: myId || "me", audio: pendingAudio }]);
      setPendingAudio(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // ⌨️ Text
    const msg = inputRef.current?.value?.trim();
    if (msg) {
      wsRef.current.send(JSON.stringify({ type: "chat", payload: { message: msg, roomId } }));
      setMessages((prev) => [...prev, { senderId: myId || "me", message: msg }]);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // 🔽 Room mgmt
  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setStep("chat");
  };
  const joinRoom = () => {
    if (!joinInput.trim()) return alert("Enter a valid Room Id");
    setRoomId(joinInput.trim().toUpperCase());
    setStep("chat");
  };

  // ---------------- UI ----------------
   if (step === "choose") {
    return (
      <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex flex-col items-center justify-center">
        <div className="rounded-2xl w-full max-w-lg p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-6">Welcome to Chat</h1>
          <div className="flex gap-4 justify-center">
            <button
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-purple-600/80 border-purple-200/30 hover:bg-purple-700/20 transition"
              onClick={() => setStep("create")}
            >
              Create Room
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-zinc-600/80 border-zinc-400/30 hover:bg-zinc-500/90 transition"
              onClick={() => setStep("join")}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex items-center justify-center">
        <div className="rounded-2xl w-full max-w-lg p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl text-center">
          <h1 className="text-xl font-semibold mb-6">Create a Room</h1>
          <button
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-purple-600/80 border-blue-200/30 hover:bg-purple-700/20 transition w-full"
            onClick={createRoom}
          >
            Generate Room ID
          </button>
          <button
            className="mt-4 inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-zinc-600/80 border-zinc-400/30 hover:bg-zinc-500/90 transition w-full"
            onClick={() => setStep("choose")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === "join") {
    return (
      <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex items-center justify-center">
        <div className="rounded-2xl w-full max-w-lg p-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl text-center">
          <h1 className="text-xl font-semibold mb-6">Join a Room</h1>
          <input
            type="text"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Enter Room ID"
            className="flex-1 bg-white/5 text-white placeholder-zinc-500 px-4 py-2 rounded-lg border border-white/10 focus:border-blue-500 outline-none transition w-full mb-4"
          />
          <button
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-purple-600/80 border-purple-200/30 hover:bg-purple-700/20 transition w-full"
            onClick={joinRoom}
          >
            Join Room
          </button>
          <button
            className="mt-4 inline-flex items-center justify-center rounded-lg border px-4 py-2 font-medium text-white bg-zinc-600/80 border-zinc-400/30 hover:bg-zinc-500/90 transition w-full"
            onClick={() => setStep("choose")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Chat ----------------
  return (
    <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 backdrop-blur-md bg-white/5 border-b border-white/10 rounded-b-2xl shadow-xl">
        <div>
          <h1 className="text-lg font-bold mb-1">Chat Room</h1>
          <p className="text-xs text-zinc-400">
            ROOM ID: <span className="font-semibold text-purple-400">{roomId}</span>
          </p>
          <p className="text-xs text-green-400">Users in Room: {userCount}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const isMine =
            msg.senderId === myIdRef.current || msg.senderId === myId || msg.senderId === "me";
          return (
            <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-4 py-2 rounded-2xl text-sm max-w-[60%] w-fit break-words whitespace-pre-wrap backdrop-blur ${
                  isMine
                    ? "bg-white/10 text-white border border-white/15 shadow-lg"
                    : "bg-white/5 text-white border border-white/10"
                }`}
              >
                {msg.message && <span className="leading-relaxed">{msg.message}</span>}
                {msg.audio && (
                  <div
                    className={`mt-2 flex items-center gap-3 rounded-xl p-3 border ${
                      isMine
                        ? "bg-blue-500/10 border-blue-300/20"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="text-xs opacity-80">🔊 Audio</span>
                    <audio controls src={msg.audio} className="w-48 max-w-full opacity-90" />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-4 flex items-center gap-2 backdrop-blur-md bg-white/5 border-t border-white/10 rounded-t-2xl shadow-xl"
      >
        <input
          type="text"
          ref={inputRef}
          placeholder={pendingAudio ? " Audio ready to send..." : "Type a message..."}
          disabled={!!pendingAudio}
          className="flex-1 bg-white/5 text-white placeholder-zinc-500 px-4 py-2 rounded-lg border border-white/10 focus:border-purple-300 outline-none transition"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg border px-4 py-2 font-semibold text-white bg-purple-600/80 border-blue-200/30 hover:bg-purple-700/20 transition"
        >
          Send
        </button>
        <Audio
          onAudioRecorded={(blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result as string;
              setPendingAudio(base64Audio);
            };
            reader.readAsDataURL(blob);
          }}
        />
      </form>
    </div>
  );
}

export default App;
