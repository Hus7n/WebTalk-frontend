import { useState, useRef } from "react";

interface AudioProps {
  onAudioRecorded: (blob: Blob, url: string) => void;
}

export default function Audio({ onAudioRecorded }: AudioProps) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        chunks.current = [];
        const url = URL.createObjectURL(blob);
        setAudioURL(url);

        // Pass blob + url up to App
        onAudioRecorded(blob, url);

        // ✅ stop mic input
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  return (
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
      {audioURL ? (
        <div className="flex items-center gap-2">
          <audio src={audioURL} controls className="h-8" />
          {/* ✅ no green send button, App handles sending */}
        </div>
      ) : (
        <span className="text-gray-400">Tap mic to record...</span>
      )}

      <button
        onClick={recording ? stopRecording : startRecording}
        className="px-3 py-1 rounded bg-blue-500 text-white"
      >
        {recording ? "Stop" : "🎤"}
      </button>
    </div>
  );
}
