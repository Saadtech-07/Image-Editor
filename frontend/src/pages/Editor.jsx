import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fabric } from "fabric";
import { ArrowLeft, ImagePlus } from "lucide-react";
import Toolbar from "../components/editor/Toolbar.jsx";
import LayersPanel from "../components/editor/LayersPanel.jsx";
import { useEditor } from "../context/EditorContext.jsx";
import useFabric from "../hooks/useFabric.js";
import {
  assignObjectMeta,
  cloneFabricObject,
  getNextObjectName,
  removeObjectFromCanvas,
} from "../utils/fabricHelpers.js";

const shapeStyles = {
  fill: "rgba(45, 212, 191, 0.76)",
  stroke: "#ccfbf1",
  strokeWidth: 2,
};

function MissingImageState() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <div className="glass-panel max-w-md rounded-lg p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-teal-300 text-slate-950">
          <ImagePlus size={24} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-white">No processed image loaded</h1>
        <p className="mt-3 text-slate-300">Upload an image and remove its background before opening the editor.</p>
        <Link
          to="/home"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-teal-200"
        >
          <ArrowLeft size={18} />
          Back to upload
        </Link>
      </div>
    </div>
  );
}

export default function Editor({ imageUrl }) {
  const canvasElementRef = useRef(null);
  useFabric(canvasElementRef, imageUrl);

  const { canvas, activeObject, setActiveObject, syncObjects } = useEditor();
  const [activeTool, setActiveTool] = useState("select");
  const [cropReady, setCropReady] = useState(false);
  const cropStartRef = useRef(null);
  const cropRectRef = useRef(null);

  const restoreObjectInteractivity = useCallback(
    (enabled) => {
      canvas?.getObjects().forEach((fabricObject) => {
        if (!fabricObject.excludeFromLayer) {
          fabricObject.set({
            selectable: enabled,
            evented: enabled,
          });
        }
      });
    },
    [canvas],
  );

  const removeCropRect = useCallback(() => {
    if (canvas && cropRectRef.current) {
      canvas.remove(cropRectRef.current);
      canvas.requestRenderAll();
    }

    cropRectRef.current = null;
    cropStartRef.current = null;
    setCropReady(false);
  }, [canvas]);

  const selectTool = useCallback(
    (tool) => {
      if (tool !== "crop") {
        removeCropRect();
      }

      setActiveTool(tool);
    },
    [removeCropRect],
  );

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    if (activeTool !== "crop") {
      canvas.selection = true;
      canvas.defaultCursor = "default";
      restoreObjectInteractivity(true);
      canvas.requestRenderAll();
      return undefined;
    }

    canvas.discardActiveObject();
    setActiveObject(null);
    syncObjects(canvas);
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";
    restoreObjectInteractivity(false);
    canvas.requestRenderAll();

    const handleMouseDown = (event) => {
      if (event.e?.button && event.e.button !== 0) {
        return;
      }

      removeCropRect();

      const pointer = canvas.getPointer(event.e);
      cropStartRef.current = pointer;

      const cropRect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: "rgba(45, 212, 191, 0.16)",
        stroke: "#5eead4",
        strokeWidth: 2,
        strokeDashArray: [8, 6],
        selectable: false,
        evented: false,
        hasControls: false,
        excludeFromLayer: true,
      });

      cropRectRef.current = cropRect;
      setCropReady(false);
      canvas.add(cropRect);
      canvas.requestRenderAll();
    };

    const handleMouseMove = (event) => {
      const start = cropStartRef.current;
      const cropRect = cropRectRef.current;

      if (!start || !cropRect) {
        return;
      }

      const pointer = canvas.getPointer(event.e);
      const left = Math.min(start.x, pointer.x);
      const top = Math.min(start.y, pointer.y);
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);

      cropRect.set({
        left,
        top,
        width,
        height,
      });
      cropRect.setCoords();
      setCropReady(width > 8 && height > 8);
      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      cropStartRef.current = null;
      const cropRect = cropRectRef.current;

      if (!cropRect) {
        setCropReady(false);
        return;
      }

      const isLargeEnough = (cropRect.width || 0) > 8 && (cropRect.height || 0) > 8;
      setCropReady(isLargeEnough);

      if (!isLargeEnough) {
        removeCropRect();
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      cropStartRef.current = null;
      canvas.selection = true;
      canvas.defaultCursor = "default";
      restoreObjectInteractivity(true);
      canvas.requestRenderAll();
    };
  }, [activeTool, canvas, removeCropRect, restoreObjectInteractivity, setActiveObject, syncObjects]);

  const applyCrop = useCallback(() => {
    const cropRect = cropRectRef.current;

    if (!canvas || !cropRect) {
      return;
    }

    const bounds = cropRect.getBoundingRect();
    const left = Math.max(0, Math.round(bounds.left));
    const top = Math.max(0, Math.round(bounds.top));
    const width = Math.min(canvas.getWidth() - left, Math.round(bounds.width));
    const height = Math.min(canvas.getHeight() - top, Math.round(bounds.height));

    if (width < 2 || height < 2) {
      removeCropRect();
      return;
    }

    canvas.remove(cropRect);
    cropRectRef.current = null;
    setCropReady(false);
    canvas.discardActiveObject();
    canvas.renderAll();

    const croppedDataUrl = canvas.toDataURL({
      format: "png",
      left,
      top,
      width,
      height,
      multiplier: 1,
    });

    setActiveTool("select");

    fabric.Image.fromURL(croppedDataUrl, (croppedImage) => {
      assignObjectMeta(croppedImage, getNextObjectName(canvas, "Object"), "crop", {
        forceNewId: true,
      });
      croppedImage.set({
        left: Math.min(left + 28, canvas.getWidth() - width),
        top: Math.min(top + 28, canvas.getHeight() - height),
        selectable: true,
        evented: true,
      });
      canvas.add(croppedImage);
      canvas.setActiveObject(croppedImage);
      setActiveObject(croppedImage);
      canvas.requestRenderAll();
      syncObjects(canvas);
    });
  }, [canvas, removeCropRect, setActiveObject, syncObjects]);

  const addText = useCallback(() => {
    if (!canvas) {
      return;
    }

    removeCropRect();
    setActiveTool("select");

    const textbox = new fabric.Textbox("Edit text", {
      left: 120,
      top: 120,
      width: 260,
      fontSize: 36,
      fontFamily: "Inter, ui-sans-serif, system-ui",
      fontWeight: 700,
      fill: "#f8fafc",
    });

    assignObjectMeta(textbox, getNextObjectName(canvas, "Text"), "text");
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    setActiveObject(textbox);
    canvas.requestRenderAll();
    syncObjects(canvas);
  }, [canvas, removeCropRect, setActiveObject, syncObjects]);

  const addShape = useCallback(
    (shapeType) => {
      if (!canvas) {
        return;
      }

      removeCropRect();
      setActiveTool("select");

      let shape;

      if (shapeType === "circle") {
        shape = new fabric.Circle({
          ...shapeStyles,
          left: 150,
          top: 150,
          radius: 70,
        });
      } else if (shapeType === "triangle") {
        shape = new fabric.Triangle({
          ...shapeStyles,
          left: 160,
          top: 160,
          width: 150,
          height: 130,
        });
      } else {
        shape = new fabric.Rect({
          ...shapeStyles,
          left: 150,
          top: 150,
          width: 180,
          height: 120,
          rx: 8,
          ry: 8,
        });
      }

      assignObjectMeta(shape, getNextObjectName(canvas, "Shape"), "shape");
      canvas.add(shape);
      canvas.setActiveObject(shape);
      setActiveObject(shape);
      canvas.requestRenderAll();
      syncObjects(canvas);
    },
    [canvas, removeCropRect, setActiveObject, syncObjects],
  );

  const deleteSelected = useCallback(() => {
    const selectedObject = canvas?.getActiveObject();

    if (!canvas || !selectedObject) {
      return;
    }

    removeObjectFromCanvas(canvas, selectedObject);
    setActiveObject(null);
    canvas.requestRenderAll();
    syncObjects(canvas);
  }, [canvas, setActiveObject, syncObjects]);

  const duplicateSelected = useCallback(async () => {
    const selectedObject = canvas?.getActiveObject();

    if (!canvas || !selectedObject || selectedObject.type === "activeSelection") {
      return;
    }

    const clonedObject = await cloneFabricObject(selectedObject);
    const prefix = selectedObject.editorKind === "text" ? "Text" : selectedObject.editorKind === "shape" ? "Shape" : "Object";

    assignObjectMeta(clonedObject, getNextObjectName(canvas, prefix), selectedObject.editorKind || "object", {
      forceNewId: true,
    });
    clonedObject.set({
      left: (selectedObject.left || 0) + 28,
      top: (selectedObject.top || 0) + 28,
      visible: true,
      selectable: true,
      evented: true,
    });
    canvas.add(clonedObject);
    canvas.setActiveObject(clonedObject);
    setActiveObject(clonedObject);
    canvas.requestRenderAll();
    syncObjects(canvas);
  }, [canvas, setActiveObject, syncObjects]);

  const exportCanvas = useCallback(() => {
    if (!canvas) {
      return;
    }

    removeCropRect();
    canvas.discardActiveObject();
    canvas.renderAll();

    const pngDataUrl = canvas.toDataURL({
      format: "png",
      multiplier: 2,
    });
    const downloadLink = document.createElement("a");
    downloadLink.href = pngDataUrl;
    downloadLink.download = "pixelforge-export.png";
    downloadLink.click();
  }, [canvas, removeCropRect]);

  if (!imageUrl) {
    return <MissingImageState />;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950 px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.12]"
            title="Back to preview"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-white">PixelForge Editor</h1>
            <p className="text-xs text-slate-400">Fabric.js canvas workspace</p>
          </div>
        </div>
        <div className="rounded-lg border border-teal-200/20 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-100">
          {activeTool === "crop" ? "Crop mode" : "Select mode"}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Toolbar
            activeTool={activeTool}
            hasSelection={Boolean(activeObject)}
            cropReady={cropReady}
            onSelectTool={selectTool}
            onApplyCrop={applyCrop}
            onCancelCrop={removeCropRect}
            onAddText={addText}
            onAddShape={addShape}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
            onExport={exportCanvas}
          />

          <main className="grid min-w-0 flex-1 place-items-center overflow-auto bg-slate-900 p-6">
            <div className="fabric-canvas-wrapper rounded-lg border border-white/10 bg-slate-950 p-3 shadow-2xl shadow-black/40">
              <canvas ref={canvasElementRef} width="980" height="660" />
            </div>
          </main>
        </div>

        <LayersPanel className="h-56 w-full overflow-y-auto border-l-0 border-t lg:h-auto lg:w-80 lg:border-l lg:border-t-0" />
      </div>
    </div>
  );
}
