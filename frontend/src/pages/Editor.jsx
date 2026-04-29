import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fabric } from "fabric";
import { ArrowLeft, ImagePlus } from "lucide-react";
import LeftSidebar from "../components/editor/LeftSidebar.jsx";
import FloatingToolbar from "../components/editor/FloatingToolbar.jsx";
import TopBar from "../components/editor/TopBar.jsx";
import RightPanel from "../components/editor/RightPanel.jsx";
import { useEditor } from "../context/EditorContext.jsx";
import useFabric from "../hooks/useFabric.js";
import ToolManager from "../tools/ToolManager.js";
import CropTool from "../tools/CropTool.js";
import DrawTool from "../tools/DrawTool.js";
import EraserTool from "../tools/EraserTool.js";
import { loadStoredEditorSession, saveStoredEditorSession } from "../utils/editorStorage.js";
import { ensureFabricEraserSupport, hasFabricEraserSupport } from "../utils/fabricEraserSupport.js";
import {
  FABRIC_SERIALIZATION_PROPS,
  assignObjectMeta,
  cloneFabricObject,
  fitImageToCanvas,
  getBaseImageObject,
  getNextObjectName,
  getSelectedOrBaseImageObject,
  removeObjectFromCanvas,
} from "../utils/fabricHelpers.js";

const shapeStyles = {
  fill: "rgba(45, 212, 191, 0.76)",
  stroke: "#ccfbf1",
  strokeWidth: 2,
};

const INITIAL_TOOL_SETTINGS = {
  draw: {
    color: "#2dd4bf",
    size: 6,
  },
  eraser: {
    size: 24,
    inverted: false,
  },
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
  const canvasContainerRef = useRef(null);
  const toolManagerRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isRestoringHistoryRef = useRef(false);
  const restoredSessionRef = useRef(false);
  const baseImageIdRef = useRef(null);
  const baseImageInitializedRef = useRef(false);
  const storedSession = useMemo(() => loadStoredEditorSession(imageUrl), [imageUrl]);

  useFabric(canvasElementRef, imageUrl, {
    skipInitialImageLoad: Boolean(storedSession),
  });

  const { canvas, objects, activeObject, setActiveObject, syncObjects } = useEditor();
  const [activeTool, setActiveTool] = useState("select");
  const [toolSettings, setToolSettings] = useState(INITIAL_TOOL_SETTINGS);
  const [toolMessage, setToolMessage] = useState("");
  const [eraserSupported, setEraserSupported] = useState(() => hasFabricEraserSupport());
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    let isMounted = true;

    void ensureFabricEraserSupport().then((supported) => {
      if (isMounted) {
        setEraserSupported(supported);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  useEffect(() => {
    setHistory([]);
    setHistoryIndex(-1);
    historyRef.current = [];
    historyIndexRef.current = -1;
    restoredSessionRef.current = false;
    baseImageIdRef.current = null;
    baseImageInitializedRef.current = false;
    setToolMessage("");
    setActiveTool("select");
  }, [imageUrl]);

  const persistEditorSession = useCallback(
    (targetCanvas, serializedCanvas) => {
      if (!targetCanvas) {
        return;
      }

      const activeObjectId = targetCanvas.getActiveObject()?.editorId || null;

      saveStoredEditorSession({
        sourceImageUrl: imageUrl,
        canvas: serializedCanvas || JSON.stringify(targetCanvas.toJSON(FABRIC_SERIALIZATION_PROPS)),
        zoom: targetCanvas.getZoom(),
        viewportTransform: Array.isArray(targetCanvas.viewportTransform)
          ? [...targetCanvas.viewportTransform]
          : null,
        activeObjectId,
        baseImageId: baseImageIdRef.current,
      });
    },
    [imageUrl],
  );

  const snapshotCanvas = useCallback(
    (targetCanvas = canvas) => {
      if (!targetCanvas || isRestoringHistoryRef.current) {
        return;
      }

      const snapshot = JSON.stringify(targetCanvas.toJSON(FABRIC_SERIALIZATION_PROPS));
      const nextHistoryBase = historyRef.current.slice(0, historyIndexRef.current + 1);

      if (nextHistoryBase[nextHistoryBase.length - 1] === snapshot) {
        return;
      }

      const nextHistory = [...nextHistoryBase, snapshot].slice(-50);
      const nextIndex = nextHistory.length - 1;

      historyRef.current = nextHistory;
      historyIndexRef.current = nextIndex;
      setHistory(nextHistory);
      setHistoryIndex(nextIndex);
      persistEditorSession(targetCanvas, snapshot);
    },
    [canvas, persistEditorSession],
  );

  const refreshSelectionOutline = useCallback(
    (selectedObject = canvas?.getActiveObject() || null) => {
      if (!canvas) {
        return;
      }

      canvas.getObjects().forEach((object) => {
        const isBaseImage = Boolean(baseImageIdRef.current && object.editorId === baseImageIdRef.current);

        object.isBaseImage = isBaseImage;
        object.set({
          borderColor: isBaseImage && selectedObject === object ? "#22d3ee" : "transparent",
          cornerColor: isBaseImage && selectedObject === object ? "#22d3ee" : "transparent",
          cornerStrokeColor: isBaseImage && selectedObject === object ? "#22d3ee" : "transparent",
          cornerSize: 10,
        });
      });

      canvas.requestRenderAll();
    },
    [canvas],
  );

  const centerBaseImageInWorkspace = useCallback(() => {
    if (!canvas || !canvasContainerRef.current) {
      return false;
    }

    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return false;
    }

    const baseImage = getBaseImageObject(canvas);

    if (!baseImage || !baseImage.width || !baseImage.height) {
      return false;
    }

    const scale = Math.min(
      canvasWidth / baseImage.width,
      canvasHeight / baseImage.height,
      1,
    );

    baseImageIdRef.current = baseImage.editorId;
    baseImage.isBaseImage = true;
    baseImage.set({
      scaleX: scale,
      scaleY: scale,
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: "center",
      originY: "center",
    });
    baseImage.setCoords();
    canvas.setActiveObject(baseImage);
    refreshSelectionOutline(baseImage);
    syncObjects(canvas);

    return true;
  }, [canvas, refreshSelectionOutline, syncObjects]);

  const updateCanvasSize = useCallback(() => {
    if (!canvas || !canvasContainerRef.current) {
      return;
    }

    const container = canvasContainerRef.current;

    if (container.clientWidth <= 0 || container.clientHeight <= 0) {
      return;
    }

    canvas.setWidth(container.clientWidth);
    canvas.setHeight(container.clientHeight);

    if (!baseImageInitializedRef.current) {
      const centered = centerBaseImageInWorkspace();

      if (centered) {
        baseImageInitializedRef.current = true;
      }
    }

    canvas.requestRenderAll();
  }, [canvas, centerBaseImageInWorkspace]);

  useEffect(() => {
    const handleResize = () => {
      updateCanvasSize();
    };

    const timer = window.setTimeout(() => updateCanvasSize(), 100);
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    if (!canvas || baseImageInitializedRef.current || objects.length === 0) {
      return;
    }

    const centered = centerBaseImageInWorkspace();

    if (centered) {
      baseImageInitializedRef.current = true;
    }
  }, [canvas, centerBaseImageInWorkspace, objects.length]);

  useEffect(() => {
    if (!canvas || !storedSession || restoredSessionRef.current) {
      return;
    }

    restoredSessionRef.current = true;
    isRestoringHistoryRef.current = true;
    baseImageInitializedRef.current = true;

    canvas.clear();
    canvas.loadFromJSON(storedSession.canvas, () => {
      const savedViewportTransform =
        Array.isArray(storedSession.viewportTransform) &&
        storedSession.viewportTransform.length === 6
          ? [...storedSession.viewportTransform]
          : null;

      if (savedViewportTransform) {
        canvas.setViewportTransform(savedViewportTransform);
      }

      const restoredZoom = typeof storedSession.zoom === "number"
        ? storedSession.zoom
        : savedViewportTransform
          ? savedViewportTransform[0]
          : 1;

      setZoom(restoredZoom);
      baseImageIdRef.current = storedSession.baseImageId || getBaseImageObject(canvas)?.editorId || null;

      const restoredActiveObject = storedSession.activeObjectId
        ? canvas.getObjects().find((object) => object.editorId === storedSession.activeObjectId)
        : null;

      if (restoredActiveObject) {
        canvas.setActiveObject(restoredActiveObject);
        setActiveObject(restoredActiveObject);
        refreshSelectionOutline(restoredActiveObject);
      } else {
        canvas.discardActiveObject();
        setActiveObject(null);
        refreshSelectionOutline(null);
      }

      historyRef.current = [storedSession.canvas];
      historyIndexRef.current = 0;
      setHistory([storedSession.canvas]);
      setHistoryIndex(0);
      syncObjects(canvas);
      canvas.requestRenderAll();
      isRestoringHistoryRef.current = false;
    });
  }, [canvas, refreshSelectionOutline, setActiveObject, storedSession, syncObjects]);

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const handleSelection = (event) => {
      const selectedObject = event.selected?.[0] || canvas.getActiveObject() || null;
      refreshSelectionOutline(selectedObject);
    };

    const handleSelectionCleared = () => {
      refreshSelectionOutline(null);
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [canvas, refreshSelectionOutline]);

  useEffect(() => {
    if (!canvas || objects.length === 0 || historyIndex !== -1) {
      return;
    }

    snapshotCanvas(canvas);
  }, [canvas, historyIndex, objects.length, snapshotCanvas]);

  const selectTool = useCallback((toolId) => {
    setToolMessage("");
    setActiveTool(toolId);
  }, []);

  const updateToolSettings = useCallback((toolId, nextSettings) => {
    setToolSettings((currentSettings) => ({
      ...currentSettings,
      [toolId]: {
        ...currentSettings[toolId],
        ...nextSettings,
      },
    }));
  }, []);

  const switchToSelectMode = useCallback(() => {
    setToolMessage("");
    toolManagerRef.current?.setActiveTool("select");
    setActiveTool("select");
  }, []);

  const resolveToolSourceObject = useCallback(() => getSelectedOrBaseImageObject(canvas), [canvas]);

  const handleToolObjectCreated = useCallback(
    (fabricObject) => {
      if (!canvas) {
        return;
      }

      fabricObject.isBaseImage = false;
      canvas.add(fabricObject);
      canvas.setActiveObject(fabricObject);
      setActiveObject(fabricObject);
      refreshSelectionOutline(fabricObject);
      canvas.requestRenderAll();
      syncObjects(canvas);
      snapshotCanvas(canvas);
    },
    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects],
  );

  const handleEraserMutation = useCallback(() => {
    if (!canvas) {
      return;
    }

    canvas.requestRenderAll();
    syncObjects(canvas);
    snapshotCanvas(canvas);
  }, [canvas, snapshotCanvas, syncObjects]);

  const requestToolChange = useCallback((toolId) => {
    setActiveTool(toolId);
  }, []);

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const manager = new ToolManager({
      canvas,
      tools: {
        crop: new CropTool({
          canvas,
          fabric,
          getSourceObject: resolveToolSourceObject,
          onObjectCreated: handleToolObjectCreated,
          onRequestToolChange: requestToolChange,
          onWarning: setToolMessage,
        }),
        draw: new DrawTool({
          canvas,
          fabric,
          getSourceObject: resolveToolSourceObject,
          onObjectCreated: handleToolObjectCreated,
          onRequestToolChange: requestToolChange,
          onWarning: setToolMessage,
        }),
        eraser: new EraserTool({
          canvas,
          fabric,
          onCanvasMutation: handleEraserMutation,
          onWarning: setToolMessage,
        }),
      },
    });

    toolManagerRef.current = manager;

    return () => {
      manager.dispose();

      if (toolManagerRef.current === manager) {
        toolManagerRef.current = null;
      }
    };
  }, [canvas, handleEraserMutation, handleToolObjectCreated, requestToolChange, resolveToolSourceObject]);

  const activeToolOptions = activeTool === "draw" ? toolSettings.draw : activeTool === "eraser" ? toolSettings.eraser : undefined;

  useEffect(() => {
    const manager = toolManagerRef.current;

    if (!manager) {
      return;
    }

    const activated = manager.setActiveTool(activeTool, activeToolOptions);

    if (!activated && activeTool !== "select") {
      setActiveTool("select");
    }
  }, [activeTool, activeToolOptions]);

  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const handleObjectModified = () => {
      snapshotCanvas(canvas);
    };

      canvas.on("object:modified", handleObjectModified);

    return () => {
      canvas.off("object:modified", handleObjectModified);
    };
  }, [canvas, snapshotCanvas]);

  const addText = useCallback(
    (options = {}) => {
      if (!canvas) {
        return;
      }

      switchToSelectMode();

      const textbox = new fabric.Textbox("Edit text", {
        left: 120,
        top: 120,
        width: 260,
        fontSize: options.fontSize || 36,
        fontFamily: "Inter, ui-sans-serif, system-ui",
        fontWeight: 700,
        fill: options.color || "#f8fafc",
      });

      assignObjectMeta(textbox, getNextObjectName(canvas, "Text"), "text");
      textbox.isBaseImage = false;
      canvas.add(textbox);
      canvas.setActiveObject(textbox);
      setActiveObject(textbox);
      refreshSelectionOutline(textbox);
      canvas.requestRenderAll();
      syncObjects(canvas);
      snapshotCanvas(canvas);
    },
    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],
  );

  const addShape = useCallback(
    (shapeType) => {
      if (!canvas) {
        return;
      }

      switchToSelectMode();

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
      shape.isBaseImage = false;
      canvas.add(shape);
      canvas.setActiveObject(shape);
      setActiveObject(shape);
      refreshSelectionOutline(shape);
      canvas.requestRenderAll();
      syncObjects(canvas);
      snapshotCanvas(canvas);
    },
    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],
  );

  const deleteSelected = useCallback(() => {
    const selectedObject = canvas?.getActiveObject();

    if (!canvas || !selectedObject) {
      return;
    }

    removeObjectFromCanvas(canvas, selectedObject);
    setActiveObject(null);
    refreshSelectionOutline(null);
    canvas.requestRenderAll();
    syncObjects(canvas);
    snapshotCanvas(canvas);
  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);

  const duplicateSelected = useCallback(async () => {
    const selectedObject = canvas?.getActiveObject();

    if (!canvas || !selectedObject || selectedObject.type === "activeSelection") {
      return;
    }

    const clonedObject = await cloneFabricObject(selectedObject);
    const prefixByKind = {
      text: "Text",
      shape: "Shape",
      crop: "Crop",
      cut: "Cut",
      line: "Line",
      arrow: "Arrow",
    };
    const prefix = prefixByKind[selectedObject.editorKind] || "Object";

    assignObjectMeta(clonedObject, getNextObjectName(canvas, prefix), selectedObject.editorKind || "object", {
      forceNewId: true,
    });
    clonedObject.isBaseImage = false;
    clonedObject.set({
      left: (selectedObject.left || 0) + 28,
      top: (selectedObject.top || 0) + 28,
      visible: true,
      selectable: true,
      evented: true,
    });
    clonedObject.setCoords();

    canvas.add(clonedObject);
    canvas.setActiveObject(clonedObject);
    setActiveObject(clonedObject);
    refreshSelectionOutline(clonedObject);
    canvas.requestRenderAll();
    syncObjects(canvas);
    snapshotCanvas(canvas);
  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, syncObjects]);

  const uploadImage = useCallback(
    (file) => {
      if (!canvas) {
        return;
      }

      switchToSelectMode();

      const reader = new FileReader();

      reader.onload = (event) => {
        fabric.Image.fromURL(event.target?.result, (image) => {
          if (!image) {
            return;
          }

          fitImageToCanvas(image, canvas);
          image.set({
            selectable: true,
            evented: true,
            erasable: true,
          });
          image.setCoords();

          assignObjectMeta(image, getNextObjectName(canvas, "Object"), "upload", {
            forceNewId: true,
          });
          image.isBaseImage = false;

          canvas.add(image);
          canvas.setActiveObject(image);
          setActiveObject(image);
          refreshSelectionOutline(image);
          canvas.requestRenderAll();
          syncObjects(canvas);
          snapshotCanvas(canvas);
        });
      };

      reader.readAsDataURL(file);
    },
    [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects],
  );

  const addLine = useCallback(() => {
    if (!canvas) {
      return;
    }

    switchToSelectMode();

    const line = new fabric.Line([50, 100, 200, 100], {
      ...shapeStyles,
      strokeWidth: 3,
      selectable: true,
      evented: true,
    });

    assignObjectMeta(line, getNextObjectName(canvas, "Line"), "line");
    line.isBaseImage = false;
    canvas.add(line);
    canvas.setActiveObject(line);
    setActiveObject(line);
    refreshSelectionOutline(line);
    canvas.requestRenderAll();
    syncObjects(canvas);
    snapshotCanvas(canvas);
  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects]);

  const addArrow = useCallback(() => {
    if (!canvas) {
      return;
    }

    switchToSelectMode();

    const line = new fabric.Line([50, 100, 150, 100], {
      ...shapeStyles,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    });

    const triangle = new fabric.Triangle({
      ...shapeStyles,
      left: 150,
      top: 100,
      width: 20,
      height: 20,
      angle: 90,
      selectable: false,
      evented: false,
    });

    const arrow = new fabric.Group([line, triangle], {
      left: 100,
      top: 100,
      selectable: true,
      evented: true,
    });

    assignObjectMeta(arrow, getNextObjectName(canvas, "Arrow"), "arrow");
    arrow.isBaseImage = false;
    canvas.add(arrow);
    canvas.setActiveObject(arrow);
    setActiveObject(arrow);
    refreshSelectionOutline(arrow);
    canvas.requestRenderAll();
    syncObjects(canvas);
    snapshotCanvas(canvas);
  }, [canvas, refreshSelectionOutline, setActiveObject, snapshotCanvas, switchToSelectMode, syncObjects]);

  const loadHistoryState = useCallback(
    (nextIndex) => {
      if (!canvas || nextIndex < 0 || nextIndex >= historyRef.current.length) {
        return;
      }

      isRestoringHistoryRef.current = true;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);

      canvas.loadFromJSON(historyRef.current[nextIndex], () => {
        canvas.discardActiveObject();
        setActiveObject(null);
        refreshSelectionOutline(null);
        canvas.requestRenderAll();
        syncObjects(canvas);
        persistEditorSession(canvas, historyRef.current[nextIndex]);
        isRestoringHistoryRef.current = false;
      });
    },
    [canvas, persistEditorSession, refreshSelectionOutline, setActiveObject, syncObjects],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      loadHistoryState(historyIndexRef.current - 1);
    }
  }, [loadHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      loadHistoryState(historyIndexRef.current + 1);
    }
  }, [loadHistoryState]);

  const zoomIn = useCallback(() => {
    if (!canvas) {
      return;
    }

    const nextZoom = Math.min(zoom * 1.2, 5);
    setZoom(nextZoom);
    canvas.setZoom(nextZoom);
    canvas.requestRenderAll();
    persistEditorSession(canvas);
  }, [canvas, persistEditorSession, zoom]);

  const zoomOut = useCallback(() => {
    if (!canvas) {
      return;
    }

    const nextZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(nextZoom);
    canvas.setZoom(nextZoom);
    canvas.requestRenderAll();
    persistEditorSession(canvas);
  }, [canvas, persistEditorSession, zoom]);

  const resetCanvas = useCallback(() => {
    if (!canvas) {
      return;
    }

    setZoom(1);
    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
    persistEditorSession(canvas);
  }, [canvas, persistEditorSession]);

  const saveProject = useCallback(() => {
    if (!canvas) {
      return;
    }

    const projectData = {
      version: "1.0",
      canvas: canvas.toJSON(FABRIC_SERIALIZATION_PROPS),
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pixelforge-project-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [canvas]);

  const exportCanvas = useCallback(() => {
    if (!canvas) {
      return;
    }

    canvas.discardActiveObject();

    const baseImage = getBaseImageObject(canvas);
    const previousVisibility = baseImage?.visible;
    const previousBackground = canvas.backgroundColor;

    if (baseImage) {
      baseImage.set({ visible: false });
    }

    canvas.setBackgroundColor("transparent", canvas.renderAll.bind(canvas));

    const pngDataUrl = canvas.toDataURL({
      format: "png",
      multiplier: 2,
    });

    if (baseImage) {
      baseImage.set({ visible: previousVisibility });
    }

    canvas.setBackgroundColor(previousBackground, canvas.renderAll.bind(canvas));

    const downloadLink = document.createElement("a");
    downloadLink.href = pngDataUrl;
    downloadLink.download = "pixelforge-export.png";
    downloadLink.click();
  }, [canvas]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!canvas) {
        return;
      }

      const targetTag = event.target?.tagName;

      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelected();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "v":
          selectTool("select");
          break;
        case "c":
          selectTool("crop");
          break;
        case "d":
          selectTool("draw");
          break;
        case "e":
          selectTool("eraser");
          break;
        case "t":
          addText();
          break;
        case "l":
          addLine();
          break;
        case "a":
          addArrow();
          break;
        case "r":
          addShape("rect");
          break;
        case "o":
          addShape("circle");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addArrow, addLine, addShape, addText, canvas, deleteSelected, duplicateSelected, redo, selectTool, undo]);

  if (!imageUrl) {
    return <MissingImageState />;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <TopBar
        canvas={canvas}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetCanvas={resetCanvas}
        onExport={exportCanvas}
        onSaveProject={saveProject}
        zoom={zoom}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar
          activeTool={activeTool}
          toolSettings={toolSettings}
          toolMessage={toolMessage}
          eraserSupported={eraserSupported}
          hasSelection={Boolean(activeObject)}
          onToolSelect={selectTool}
          onToolSettingsChange={updateToolSettings}
          onAddText={addText}
          onAddShape={addShape}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onUpload={uploadImage}
        />

        <main className="relative flex min-w-0 flex-1 bg-slate-900">
          <div ref={canvasContainerRef} className="fabric-canvas-wrapper relative h-full w-full">
            <canvas ref={canvasElementRef} />
          </div>

          <FloatingToolbar
            selectedObject={activeObject}
            canvas={canvas}
            onUpdate={() => {
              if (!canvas) {
                return;
              }

              syncObjects(canvas);
              snapshotCanvas(canvas);
            }}
          />
        </main>

        <RightPanel />
      </div>
    </div>
  );
}
