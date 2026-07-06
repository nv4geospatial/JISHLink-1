/**
 * /attend/:siteToken — deep-link QR scan handler.
 *
 * Flow:
 * 1. If not logged in → redirect to /login?redirect=/attend/:token
 * 2. Request GPS permission
 * 3. Auto-call POST /attendance/scan with site_token + GPS
 * 4. Show result
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api";

type ScanResult = {
  success: boolean;
  action: "check_in" | "check_out";
  status: string;
  site_name: string;
  time: string;
  distance_meters: number;
};

export default function AttendPage() {
  const params = useParams<{ siteToken: string }>();
  const siteToken = params.siteToken;
  const [, navigate] = useLocation();
  const { token, employee } = useAuth();

  const [phase, setPhase] = useState<"gps" | "scanning" | "success" | "error">("gps");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [errCode, setErrCode] = useState<string>("");
  const [errDetails, setErrDetails] = useState<Record<string, unknown> | null>(null);
  const attempted = useRef(false);

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      setErrCode(err.code);
      setErrDetails(err.details ?? null);
      switch (err.code) {
        case "WRONG_SITE":
          setErrMsg("You are not assigned to this site. Please move to your assigned site location or contact your supervisor.");
          break;
        case "OUTSIDE_GEOFENCE":
          setErrMsg(`You are ${(err.details?.distance_meters as number) ?? "far"}m away from the site. Please move closer to the site entrance to check in.`);
          break;
        case "OUTSIDE_SHIFT_WINDOW":
          setErrMsg(`Outside attendance window. Shift: ${err.details?.shift_start ?? ""} – ${err.details?.shift_end ?? ""}`);
          break;
        case "ALREADY_CHECKED_OUT":
          setErrMsg("You have already checked in and out today.");
          break;
        case "INVALID_QR":
          setErrMsg("This QR code is not recognized. Please scan a valid QR code.");
          break;
        case "NOT_ASSIGNED":
          setErrMsg("Employee not found or inactive. Please contact your supervisor.");
          break;
        default:
          setErrMsg(err.message);
      }
    } else {
      setErrCode("UNKNOWN");
      setErrMsg((err as Error).message || "Something went wrong. Please try again.");
    }
    setPhase("error");
  }, []);

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, { title: string; msg: string; isSettings: boolean }> = {
      1: {
        title: "Location Access Blocked",
        msg: "Your browser is blocking location access. Please enable it in your browser settings.",
        isSettings: true,
      },
      2: {
        title: "Location Unavailable",
        msg: "Could not get your location. Please make sure GPS is turned ON in your phone settings and you are in an open area.",
        isSettings: true,
      },
      3: {
        title: "Location Timed Out",
        msg: "Getting location took too long. Please make sure GPS is turned ON in your phone settings and try again.",
        isSettings: true,
      },
    };
    const info = messages[err.code] ?? { title: "Location Error", msg: "Could not determine your location.", isSettings: false };
    setErrMsg(info.msg);
    setErrCode("GEO_ERROR");
    setErrDetails({ geoCode: err.code, title: info.title, isSettings: info.isSettings });
    setPhase("error");
  }, []);

  const acquireLocationAndScan = useCallback(() => {
    if (!navigator.geolocation) {
      setErrMsg("Geolocation is not supported by your browser.");
      setErrCode("NO_GEO");
      setPhase("error");
      return;
    }

    setPhase("gps");
    setErrMsg("");
    setErrCode("");
    setErrDetails(null);

    let watchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let hasResult = false;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onSuccess = async (pos: GeolocationPosition) => {
      if (hasResult) return;
      hasResult = true;
      cleanup();

      setPhase("scanning");
      try {
        const data = await apiFetch<ScanResult>("/attendance/scan", {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify({
            site_token: siteToken,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            device_id: getDeviceId(),
          }),
        });
        setResult(data);
        setPhase("success");
      } catch (err: unknown) {
        handleApiError(err);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (hasResult) return;
      hasResult = true;
      cleanup();
      handleGeoError(err);
    };

    // Strategy 1: getCurrentPosition (fastest if cached)
    const tryGetCurrent = () => {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          if (err.code === 3 || err.code === 2) {
            tryWatchPosition();
          } else {
            onError(err);
          }
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 600000 },
      );
    };

    // Strategy 2: watchPosition for cold GPS start
    const tryWatchPosition = () => {
      watchId = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
      );

      timeoutId = setTimeout(() => {
        if (!hasResult) {
          cleanup();
          setErrMsg("Getting location timed out. Please make sure GPS is turned ON in your phone settings and try again.");
          setErrCode("GEO_TIMEOUT");
          setErrDetails({ isSettings: true, title: "GPS Timeout" });
          setPhase("error");
        }
      }, 12000);
    };

    const timer = setTimeout(() => {
      tryGetCurrent();
    }, 400);

    return () => {
      hasResult = true;
      cleanup();
      clearTimeout(timer);
    };
  }, [siteToken, token, handleApiError, handleGeoError]);

  useEffect(() => {
    if (!token) {
      navigate(`/login?redirect=/attend/${siteToken}`);
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    const cleanupFn = acquireLocationAndScan();
    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [token, siteToken, navigate, acquireLocationAndScan]);

  const handleRetry = () => {
    attempted.current = false;
    acquireLocationAndScan();
  };

  // Determine if we should show the "How to enable GPS" helper
  const showGpsHelp = errCode === "GEO_ERROR" || errCode === "GEO_TIMEOUT";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      {phase === "gps" && (
        <div>
          <div className="text-6xl mb-6 animate-pulse">📍</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Getting your location…</h2>
          <p className="text-muted-foreground text-sm">Please allow location access when prompted</p>
        </div>
      )}

      {phase === "scanning" && (
        <div>
          <div className="text-6xl mb-6 animate-spin">⏳</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Recording attendance…</h2>
          <p className="text-muted-foreground text-sm">Hello, {employee?.name} 👋</p>
        </div>
      )}

      {phase === "success" && result && (
        <div>
          <div className="text-7xl mb-5">
            {result.action === "check_in" ? "✅" : "👋"}
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">
            {result.action === "check_in" ? "Checked In!" : "Checked Out!"}
          </h2>
          <p className="text-muted-foreground mb-4">{result.site_name}</p>
          <div className="bg-white rounded-2xl shadow-sm p-5 text-left space-y-3 w-full max-w-xs mx-auto mb-6">
            <Row label="Employee" value={employee?.name ?? ""} />
            <Row label="Status" value={result.status.replace("_", " ")} />
            <Row label="Time" value={new Date(result.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} />
            <Row label="Distance" value={`${result.distance_meters}m from site`} />
          </div>
          <button onClick={() => navigate("/home")}
            className="w-full max-w-xs bg-primary text-white py-3 rounded-xl font-semibold">
            Back to Home
          </button>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="text-6xl mb-5">❌</div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {errDetails && "title" in errDetails ? (errDetails.title as string) : "Check-in Failed"}
          </h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">{errMsg}</p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={handleRetry}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold">
              Try Again
            </button>

            {showGpsHelp && (
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg text-left space-y-1">
                <strong className="text-foreground">How to enable GPS:</strong>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Open your phone <strong>Settings</strong></li>
                  <li>Go to <strong>Location</strong> and turn it <strong>ON</strong></li>
                  <li>Return to this browser and tap <strong>Try Again</strong></li>
                </ol>
                <p className="pt-1 text-[11px] text-amber-600">
                  If location is already ON, tap the 🔒 lock icon in the browser address bar and set Location to "Allow".
                </p>
              </div>
            )}

            {errCode === "WRONG_SITE" && (
              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 p-3 rounded-lg text-left">
                <strong className="text-amber-800">Not your assigned site?</strong>
                <p className="mt-1">Please move to your assigned work location or contact your supervisor to update your site assignment.</p>
              </div>
            )}

            {errCode === "OUTSIDE_GEOFENCE" && (
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded-lg text-left">
                <strong className="text-blue-800">Too far from site?</strong>
                <p className="mt-1">Walk closer to the site entrance and try again. You must be within 100 meters of the site.</p>
              </div>
            )}

            <button onClick={() => navigate("/scan")}
              className="w-full border border-border text-foreground py-3 rounded-xl font-semibold">
              Open Scanner
            </button>
            <button onClick={() => navigate("/home")}
              className="text-muted-foreground text-sm py-2">
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}

function getDeviceId(): string {
  let id: string | null = localStorage.getItem("jishlink_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("jishlink_device_id", id);
  }
  return id;
}
