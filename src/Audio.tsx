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

        // Pass blob + url up to parent
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
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur px-3 py-2">
      <div className="flex items-center gap-3">
        {audioURL ? (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1">
            <span className="text-xs opacity-80">Preview</span>
            <audio src={audioURL} controls className="h-8 opacity-90" />
          </div>
        ) : (
          <span className="text-xs text-zinc-400">
            {recording ? "Recording..." : "Tap mic to record"}
          </span>
        )}
      </div>

      <button
        onClick={recording ? stopRecording : startRecording}
        className={`px-3 py-2 rounded-lg font-medium transition border ${
          recording
            ? "bg-red-500/20 text-red-200 border-red-400/30 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
            : "bg-purple-500/20 text-blue-200 border-purple-400/30 hover:bg-purple-500/25"
        }`}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? "Stop" : "🎤 Record"}
      </button>
    </div>
  );
}
