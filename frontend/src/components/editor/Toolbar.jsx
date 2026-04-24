import {
  Copy,
  Download,
  Check,
  MousePointer2,
  Scissors,
  Shapes,
  Square,
  Circle,
  Trash2,
  Type,
  X,
} from "lucide-react";

function ToolButton({ title, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
        active
          ? "border-teal-200 bg-teal-300 text-slate-950 shadow-glow"
          : "border-white/10 bg-white/[0.06] text-slate-200 hover:-translate-y-0.5 hover:bg-white/[0.12]"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function Toolbar({
  activeTool,
  hasSelection,
  cropReady,
  onSelectTool,
  onApplyCrop,
  onCancelCrop,
  onAddText,
  onAddShape,
  onDelete,
  onDuplicate,
  onExport,
}) {
  return (
    <aside className="flex w-20 shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-slate-950/95 px-3 py-5">
      <ToolButton title="Select" active={activeTool === "select"} onClick={() => onSelectTool("select")}>
        <MousePointer2 size={20} />
      </ToolButton>
      <ToolButton title="Crop" active={activeTool === "crop"} onClick={() => onSelectTool("crop")}>
        <Scissors size={20} />
      </ToolButton>

      {activeTool === "crop" ? (
        <div className="flex flex-col gap-2 border-y border-white/10 py-3">
          <button
            type="button"
            title="Apply crop"
            disabled={!cropReady}
            onClick={onApplyCrop}
            className="grid h-10 w-10 place-items-center rounded-lg bg-teal-300 text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            title="Cancel crop"
            onClick={onCancelCrop}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.12]"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <ToolButton title="Add text" onClick={onAddText}>
        <Type size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Add rectangle" onClick={() => onAddShape("rect")}>
        <Square size={20} />
      </ToolButton>
      <ToolButton title="Add circle" onClick={() => onAddShape("circle")}>
        <Circle size={20} />
      </ToolButton>
      <ToolButton title="Add triangle" onClick={() => onAddShape("triangle")}>
        <Shapes size={20} />
      </ToolButton>

      <div className="my-1 h-px w-full bg-white/10" />

      <ToolButton title="Duplicate selected object" disabled={!hasSelection} onClick={onDuplicate}>
        <Copy size={20} />
      </ToolButton>
      <ToolButton title="Delete selected object" disabled={!hasSelection} onClick={onDelete}>
        <Trash2 size={20} />
      </ToolButton>

      <div className="mt-auto">
        <ToolButton title="Export PNG" onClick={onExport}>
          <Download size={20} />
        </ToolButton>
      </div>
    </aside>
  );
}
