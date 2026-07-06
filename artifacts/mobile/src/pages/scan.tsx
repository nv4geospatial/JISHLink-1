/**
 * /scan — Camera QR scanner fallback.
 * Uses the device camera + jsQR to decode a JISHLink site QR code,
 * then auto-redirects to /attend/:siteToken.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import jsQR from "jsqr";

export default function ScanPage() {
  const [, navigate] = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [found, setFound] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let stopped = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current && !stopped) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tick();
        }
      } catch {
        setError("Camera access denied. Please allow camera permission and reload.");
        setScanning(false);
      }
    }

    function tick() {
      if (stopped || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code?.data) {
          // Extract siteToken from deep-link URL
          // Format: https://<domain>/mobile/attend/<token>
          const match = code.data.match(/\/attend\/([a-f0-9]+)/);
          if (match) {
            setScanning(false);
            setFound(code.data);
            stopStream();
            navigate(`/attend/${match[1]}`);
            return;
          } else {
            // QR found but not a JISHLink QR
          }
        }
      }

      animRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      stopped = true;
      cancelAnimationFrame(animRef.current);
      stopStream();
    };
  }, [navigate]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 bg-black/80 z-10 relative">
        <button onClick={() => navigate("/home")} className="text-white text-2xl">←</button>
        <h1 className="text-white font-semibold text-lg">Scan QR Code</h1>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {scanning && !error && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
          />
        )}

        {/* Overlay frame */}
        {scanning && !error && (
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-64 h-64 relative">
              {/* Corner markers */}
              {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                <div key={pos} className={`absolute w-8 h-8 border-4 border-accent ${
                  pos === "top-left" ? "top-0 left-0 border-r-0 border-b-0" :
                  pos === "top-right" ? "top-0 right-0 border-l-0 border-b-0" :
                  pos === "bottom-left" ? "bottom-0 left-0 border-r-0 border-t-0" :
                  "bottom-0 right-0 border-l-0 border-t-0"
                } rounded-sm`} />
              ))}
              {/* Scanning line animation */}
              <div className="absolute inset-x-0 h-0.5 bg-accent/80 animate-scan-line" style={{ animation: "scanLine 2s linear infinite" }} />
            </div>
            <p className="text-white text-sm mt-6 bg-black/40 px-4 py-2 rounded-full">
              Point at the site QR code
            </p>
          </div>
        )}

        {error && (
          <div className="z-10 text-center px-8">
            <div className="text-5xl mb-4">📵</div>
            <p className="text-white font-semibold mb-2">Camera unavailable</p>
            <p className="text-gray-300 text-sm mb-6">{error}</p>
            <button onClick={() => navigate("/home")}
              className="bg-accent text-white px-6 py-3 rounded-xl font-semibold">
              Back to Home
            </button>
          </div>
        )}

        {found && (
          <div className="z-10 text-center">
            <div className="text-5xl mb-4 animate-bounce">✅</div>
            <p className="text-white font-semibold">QR detected! Redirecting…</p>
          </div>
        )}
      </div>

      {/* Hidden canvas for jsQR processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom hint */}
      <div className="bg-black/80 px-6 py-6 text-center">
        <p className="text-gray-400 text-xs">
          Make sure you have good lighting and hold the camera steady
        </p>
        <button onClick={() => navigate("/home")}
          className="text-accent text-sm font-medium mt-3 block mx-auto">
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
      `}</style>
    </div>
  );
}
