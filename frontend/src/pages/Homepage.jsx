import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ImagePlus, Loader2, UploadCloud, WandSparkles } from "lucide-react";
import Header from "../components/layout/Header.jsx";
import { removeBackground } from "../utils/imageHelpers.js";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function PreviewPanel({ title, imageUrl, emptyLabel, isProcessed }) {
  return (
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex min-h-[420px] flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">{title}</h2>
        {isProcessed ? (
          <span className="rounded-lg bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">PNG</span>
        ) : null}
      </div>
        
      <div className="checkerboard mt-4 grid flex-1 place-items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="max-h-[520px] w-full object-contain" />
        ) : (
          <p className="px-6 text-center text-sm text-gray-400">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

export default function Homepage({ imageState, onUpload, onProcessed }) {
  const inputRef = useRef(null);
  const removeInFlightRef = useRef(false);
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState("");

  const uploadFile = (file) => {
    try {
      onUpload(file);
      setError("");
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const handleRemoveBackground = async () => {
    if (!imageState.originalFile || removeInFlightRef.current) {
      return;
    }

    removeInFlightRef.current = true;
    setIsRemoving(true);
    setError("");

    try {
      const processedBlob = await removeBackground(imageState.originalFile, API_URL);
      onProcessed(processedBlob);
    } catch (removeError) {
      setError(removeError.message || "Background removal failed.");
    } finally {
      removeInFlightRef.current = false;
      setIsRemoving(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];

    if (file) {
      uploadFile(file);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      uploadFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 text-gray-900">
      <Header onUpload={onUpload} />

      <main className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Preview</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Upload, remove background, then edit</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              Compare the uploaded image with the transparent result before opening the editor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-md transition hover:-translate-y-0.5 hover:bg-gray-50"
            >
              <ImagePlus size={18} />
              Upload Image
            </button>
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={!imageState.originalFile || isRemoving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRemoving ? <Loader2 className="animate-spin" size={18} /> : <WandSparkles size={18} />}
              Remove Background
            </button>
            <button
              type="button"
              onClick={() => navigate("/editor")}
              disabled={!imageState.processedUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Editor
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {!imageState.originalUrl ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`grid min-h-[460px] w-full place-items-center rounded-lg border border-dashed p-8 text-center transition ${
              isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"
            }`}
          >
            <span>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-blue-500 text-white">
                <UploadCloud size={28} />
              </span>
              <span className="mt-5 block text-xl font-semibold text-gray-900">Drop an image here or browse</span>
              <span className="mt-2 block text-sm text-gray-600">PNG, JPG, WEBP, or any browser-supported image file</span>
            </span>
          </button>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <PreviewPanel title="Original Image" imageUrl={imageState.originalUrl} emptyLabel="Upload an image to begin." />
            <PreviewPanel
              title="Processed Image"
              imageUrl={imageState.processedUrl}
              emptyLabel={isRemoving ? "Removing background..." : "Run background removal to see the transparent result."}
              isProcessed={Boolean(imageState.processedUrl)}
            />
          </div>
        )}

        {error ? (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </main>
    </div>
  );
}
