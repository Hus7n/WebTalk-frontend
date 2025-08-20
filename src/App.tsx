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

      if (data.type === "id") setMyId(data.payload.senderId);

      if (data.type === "chat") {
        setMessages((prev) => [...prev, { senderId: data.payload.senderId, message: data.payload.message }]);
      }

      if (data.type === "audio-message") {
        setMessages((prev) => [...prev, { senderId: data.payload.senderId, audio: data.payload.audio }]);
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
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-6">Welcome to Chat</h1>
        <div className="space-x-4">
          <button className="bg-blue-600 px-4 py-2 rounded-md" onClick={() => setStep("create")}>
            Create Room
          </button>
          <button className="bg-zinc-700 px-4 py-2 rounded-md" onClick={() => setStep("join")}>
            Join Room
          </button>
        </div>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-xl mb-4">Create a Room</h1>
        <button className="bg-blue-600 px-4 py-2 rounded-md" onClick={createRoom}>
          Generate Room ID
        </button>
        <button className="mt-4 bg-zinc-700 px-4 py-2 rounded-md" onClick={() => setStep("choose")}>
          Back
        </button>
      </div>
    );
  }

  if (step === "join") {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-xl mb-4">Join a Room</h1>
        <input
          type="text"
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value)}
          placeholder="Enter Room ID"
          className="bg-zinc-900 text-white px-4 py-2 rounded-md mb-4 border border-zinc-700"
        />
        <button className="bg-blue-600 px-4 py-2 rounded-md" onClick={joinRoom}>
          Join Room
        </button>
        <button className="mt-4 bg-zinc-700 px-4 py-2 rounded-md" onClick={() => setStep("choose")}>
          Back
        </button>
      </div>
    );
  }

  // ---------------- Chat ----------------
  return (
    <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 backdrop-blur-md bg-white/5 border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold mb-1">Chat Room</h1>
          <p className="text-xs text-zinc-400">
            ROOM ID: <span className="font-semibold text-blue-400">{roomId}</span>
          </p>
          <p className="text-xs text-green-400">Users in Room: {userCount}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.senderId === myId ? "justify-end" : "justify-start"}`}>
            <div
              className={`px-4 py-2 rounded-lg max-w-xs text-sm ${
                msg.senderId === myId
                  ? "bg-blue-500 text-white self-end"
                  : "bg-gray-200 text-black self-start"
              }`}
            >
              {msg.message && <span>{msg.message}</span>}
              {msg.audio && <audio controls src={msg.audio} className="mt-2 w-48 rounded" />}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-4 flex items-center gap-2 backdrop-blur-md bg-white/5 border-t border-white/10"
      >
        <input
          type="text"
          ref={inputRef}
          placeholder={pendingAudio ? "🎙️ Audio ready to send..." : "Type a message..."}
          disabled={!!pendingAudio}
          className="flex-1 bg-zinc-900 text-white placeholder-zinc-500 px-4 py-2 rounded-lg border border-zinc-700 focus:border-blue-500 outline-none transition"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition"
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
