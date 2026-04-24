import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Brush,
  Film,
  ImagePlus,
  Layers,
  PenTool,
  Scissors,
  Server,
  WandSparkles,
} from "lucide-react";
import Header from "../components/layout/Header.jsx";

const features = [
  {
    icon: WandSparkles,
    title: "Background Removal",
    text: "Send the uploaded image file to the backend and receive a clean transparent PNG from remove.bg.",
  },
  {
    icon: Scissors,
    title: "Object Editing",
    text: "Snip regions into reusable objects, then move, resize, duplicate, hide, or delete them.",
  },
  {
    icon: PenTool,
    title: "Canvas Editor",
    text: "A Fabric.js workspace with layers, text, shapes, selection controls, and PNG export.",
  },
];

const stack = [
  { icon: Brush, label: "React + Tailwind" },
  { icon: Layers, label: "Fabric.js Canvas" },
  { icon: Server, label: "Node + Express" },
  { icon: Bot, label: "remove.bg API" },
];

export default function Landing({ onUpload }) {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleFile = (file) => {
    try {
      onUpload(file);
      setError("");
      navigate("/home");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header onUpload={onUpload} />

      <main>
        <section className="hero-backdrop relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950 to-transparent" />
          <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/10 px-3 py-2 text-sm text-teal-100 backdrop-blur-md">
                <BadgeCheck size={16} />
                AI-powered editing flow for modern creative teams
              </div>

              <h1 className="max-w-3xl text-5xl font-black leading-tight text-white sm:text-6xl lg:text-7xl">
                PixelForge AI Image Editor
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                Remove backgrounds, isolate objects, arrange layers, and export polished visuals from a
                Canva-like workspace built with React, Fabric.js, and Node.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-teal-200"
                >
                  <ImagePlus size={19} />
                  Upload Image
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => alert("Video creation is a planned workflow placeholder.")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.15] bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/[0.15]"
                >
                  <Film size={19} />
                  Create Video
                </button>
              </div>

              {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
            </div>
          </div>
        </section>

        <section id="features" className="bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-300">Features</p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Everything needed for the edit loop</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article key={feature.title} className="glass-panel rounded-lg p-6 transition hover:-translate-y-1 hover:border-teal-200/40">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-300 text-slate-950">
                      <Icon size={22} />
                    </span>
                    <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-slate-300">{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="stack" className="border-y border-white/10 bg-slate-900/70 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Tech Stack</p>
              <h2 className="mt-3 text-3xl font-bold text-white">Production-friendly tooling, cleanly separated</h2>
              <p className="mt-4 leading-7 text-slate-300">
                The frontend manages previews and canvas state, while the backend owns uploads, CORS, and the remove.bg API call.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {stack.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-lg shadow-black/20">
                    <Icon className="text-amber-200" size={24} />
                    <p className="mt-4 font-semibold text-white">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="about" className="bg-slate-950 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-300">About</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">A focused full-stack image editor</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              PixelForge keeps the path simple: upload an image, remove its background through the API, open it in the editor,
              snip reusable regions, and export the final canvas as a PNG.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
