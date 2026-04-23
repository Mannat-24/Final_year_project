import { useMemo, useState } from "react";

const sizeMap = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl"
};

const Avatar = ({ name, imageUrl, size = "md" }) => {
  const [error, setError] = useState(false);
  const initials = useMemo(() => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  if (imageUrl && !error) {
    return (
      <img
        className={`${sizeMap[size]} rounded-2xl object-cover ring-2 ring-white/50 dark:ring-slate-700/50`}
        src={imageUrl}
        alt={`${name || "User"} profile`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div className={`${sizeMap[size]} flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 font-bold text-white`}>
      {initials}
    </div>
  );
};

export default Avatar;
