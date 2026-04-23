import { useTheme } from "../context/ThemeContext";

const ThemeToggle = () => {
  const { dark, setDark } = useTheme();
  const sun = "\u2600";
  const moon = "\u{1F319}";

  return (
    <button
      className="fixed bottom-4 left-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/90 text-lg shadow-xl backdrop-blur transition hover:scale-105 dark:border-slate-600 dark:bg-slate-900/90"
      onClick={() => setDark(!dark)}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {dark ? moon : sun}
    </button>
  );
};

export default ThemeToggle;
