import { useEffect, useState, useRef } from "react";
import "./App.css";
import VoiceCall from "./voice";

interface ChatMessage {
  senderId: string;
  message: string;
}

function App() {
  const [message, setMessage] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | undefined>();
  const [myId, setMyId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [step, setStep] = useState<
    "choose" | "create" | "join" | "chat"
  >("choose");
  const [userCount, setUserCount] = useState<number>(0);
  const [inCall, setInCall] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
   const wsUrl = import.meta.env.VITE_WS_URL;

    if (!wsUrl) {
      console.error("WebSocket URL not found ");
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;


    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          payload: {
            roomId,
          },
        })
      );
    };

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "id") {
        setMyId(data.payload.senderId);
      }

      if (data.type === "chat") {
        setMessage((prev) => [
          ...prev,
          {
            senderId: data.payload.senderId,
            message: data.payload.message,
          },
        ]);
      }

      if (data.type === "userCount") {
        setUserCount(data.payload.count);
      }
    };

    ws.addEventListener("message", handleMessage);

    wsRef.current = ws;

    return () => {
      ws.removeEventListener("message", handleMessage);
      ws.close();
    };
  }, [roomId, step]);

  const handleSend = () => {
    const msg = inputRef.current?.value?.trim();
    if (wsRef.current && msg) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          payload: { message: msg },
        })
      );
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const createRoom = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setStep("chat");
  };

  const joinRoom = () => {
    if (!joinInput.trim()) {
      alert("Enter a valid Room Id");
      return;
    }

    setRoomId(joinInput.trim().toUpperCase());
    setStep("chat");
  };

  const handleEndCall = () => {
    setInCall(false);
  };

  
  if (step === "choose") {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-6">Welcome to Chat</h1>
        <div className="space-x-4">
          <button
            className="bg-purple-600 px-4 py-2 rounded-md"
            onClick={() => setStep("create")}
          >
            Create Room
          </button>
          <button
            className="bg-zinc-700 px-4 py-2 rounded-md"
            onClick={() => setStep("join")}
          >
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
        <button
          className="bg-purple-600 px-4 py-2 rounded-md"
          onClick={createRoom}
        >
          Generate Room ID
        </button>
        <button
          className="mt-4 bg-zinc-700 px-4 py-2 rounded-md"
          onClick={() => setStep("choose")}
        >
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
        <button
          className="bg-purple-600 px-4 py-2 rounded-md"
          onClick={joinRoom}
        >
          Join Room
        </button>
        <button
          className="mt-4 bg-zinc-700 px-4 py-2 rounded-md"
          onClick={() => setStep("choose")}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex flex-col relative">
      {/* Header */}
      <header className="flex items-center justify-between p-4 backdrop-blur-md bg-white/5 shadow-md border-b border-white/10">
        <div>
          <h1 className="text-lg font-bold mb-1">Chat Room</h1>
          <p className="text-xs text-zinc-400">
            ROOM ID:{" "}
            <span className="font-semibold text-purple-400">{roomId}</span>
          </p>
          <p className="text-xs text-green-400">
            Users in Room: {userCount}
          </p>
        </div>
      </header>
      {/* Voice Call UI */}
      {wsRef.current && myId && roomId && (
        <div className="absolute top-7 right-5">
          {!inCall ? (
            <button
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg shadow-md transition"
              onClick={() => setInCall(true)}
            >
              Start Voice Call
            </button>
          ) : (
            <VoiceCall
              ws={wsRef.current}
              roomId={roomId}
              username={`User-${myId?.slice(0, 4)}`}
              userId={myId}
              onEndCall={handleEndCall}
            />
          )}
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {message.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 flex ${
              msg.senderId === myId ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-4 py-2 rounded-xl max-w-xs text-sm font-medium backdrop-blur-md bg-white/10 border border-white/10 shadow-md ${
                msg.senderId === myId
                  ? "bg-purple-600 text-white rounded-br-none"
                  : "bg-zinc-800 text-white rounded-bl-none"
              }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 flex items-center gap-2 backdrop-blur-md bg-white/5 border-t border-white/10">
        <input
          type="text"
          ref={inputRef}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-900 text-white placeholder-zinc-500 px-4 py-2 rounded-lg outline-none border border-zinc-700 focus:border-purple-500 transition"
        />
        <button
          onClick={handleSend}
          className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
