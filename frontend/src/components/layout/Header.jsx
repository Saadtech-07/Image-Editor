import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImagePlus, Sparkles } from "lucide-react";

export default function Header({ onUpload }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      onUpload(file);
      setError("");
      navigate("/home");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/[0.82] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-400 text-slate-950 shadow-glow">
            <Sparkles size={20} />
          </span>
          <span className="text-base font-semibold tracking-wide text-white">PixelForge AI</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
          <a href="/#features" className="transition hover:text-white">
            Features
          </a>
          <a href="/#stack" className="transition hover:text-white">
            Stack
          </a>
          <a href="/#about" className="transition hover:text-white">
            About
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {error ? <span className="hidden text-sm text-rose-300 sm:inline">{error}</span> : null}
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-teal-200"
          >
            <ImagePlus size={18} />
            Upload
          </button>
        </div>
      </div>
    </header>
  );
}
