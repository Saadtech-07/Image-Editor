import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Undo, Redo, ZoomIn, ZoomOut, RotateCcw, Download, Save, Grid3x3 } from "lucide-react";

export default function TopBar({ 
  canvas, 
  onUndo, 
  onRedo, 
  onZoomIn, 
  onZoomOut, 
  onResetCanvas, 
  onExport, 
  onSaveProject,
  zoom = 1 
}) {
  const [showGrid, setShowGrid] = useState(false);

  const toggleGrid = useCallback(() => {
    if (!canvas) return;
    
    setShowGrid(!showGrid);
    
    if (!showGrid) {
      // Add grid background
      const gridSize = 20;
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = gridSize;
      gridCanvas.height = gridSize;
      const gridCtx = gridCanvas.getContext('2d');
      
      gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      gridCtx.beginPath();
      gridCtx.moveTo(0, gridSize);
      gridCtx.lineTo(gridSize, gridSize);
      gridCtx.moveTo(gridSize, 0);
      gridCtx.lineTo(gridSize, gridSize);
      gridCtx.stroke();
      
      const gridPattern = canvas.getContext().createPattern(gridCanvas, 'repeat');
      canvas.setBackgroundColor({
        source: gridPattern,
        repeat: 'repeat'
      }, canvas.renderAll.bind(canvas));
    } else {
      // Remove grid
      canvas.setBackgroundColor('#0f172a', canvas.renderAll.bind(canvas));
    }
  }, [canvas, showGrid]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950 px-4">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <Link
          to="/home"
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.12]"
          title="Back to upload"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-white">PixelForge Editor</h1>
          <p className="text-xs text-slate-400">Professional Image Editor</p>
        </div>
      </div>

      {/* Center Section - Zoom Controls */}
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1">
        <button
          onClick={onZoomOut}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="min-w-[3rem] text-center text-sm font-medium text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          onClick={onResetCanvas}
          className="grid h-7 w-7 place-items-center rounded text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          onClick={toggleGrid}
          className={`grid h-7 w-7 place-items-center rounded transition ${
            showGrid 
              ? 'bg-teal-300 text-slate-950' 
              : 'text-slate-200 hover:bg-white/[0.12] hover:text-white'
          }`}
          title="Toggle Grid"
        >
          <Grid3x3 size={16} />
        </button>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06]">
          <button
            onClick={onUndo}
            className="grid h-8 w-8 place-items-center rounded-l-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={onRedo}
            className="grid h-8 w-8 place-items-center rounded-r-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06]">
          <button
            onClick={onExport}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-200 transition hover:bg-white/[0.12] hover:text-white"
            title="Download as PNG"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
