import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MotionPreference = "system" | "on" | "off";

interface Preferences {
  motionPreference: MotionPreference;
  visuals3d: boolean;
}

interface PreferencesContextValue extends Preferences {
  reducedMotion: boolean;
  setMotionPreference: (value: MotionPreference) => void;
  setVisuals3d: (value: boolean) => void;
}

const STORAGE_KEY = "identityshield.preferences";
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { motionPreference: "system", visuals3d: true };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      motionPreference: ["system", "on", "off"].includes(
        parsed.motionPreference ?? "",
      )
        ? (parsed.motionPreference as MotionPreference)
        : "system",
      visuals3d: parsed.visuals3d !== false,
    };
  } catch {
    return { motionPreference: "system", visuals3d: true };
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readPreferences(),
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setSystemReducedMotion(event.matches);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const reducedMotion =
    preferences.motionPreference === "on" ||
    (preferences.motionPreference === "system" && systemReducedMotion);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    document.documentElement.dataset.visuals3d = preferences.visuals3d
      ? "on"
      : "off";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, reducedMotion]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      reducedMotion,
      setMotionPreference: (motionPreference) =>
        setPreferences((current) => ({ ...current, motionPreference })),
      setVisuals3d: (visuals3d) =>
        setPreferences((current) => ({ ...current, visuals3d })),
    }),
    [preferences, reducedMotion],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider.");
  }
  return context;
}
