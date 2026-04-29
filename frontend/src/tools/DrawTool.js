import {
  applyCanvasCursor,
  assignObjectMeta,
  createRasterObjectFromRegion,
  getDrawCursor,
  getNextObjectName,
  getRectIntersection,
  normalizeCanvasRect,
  setCanvasObjectInteractivity,
} from "../utils/fabricHelpers.js";

const DEFAULT_DRAW_OPTIONS = {
  color: "#2dd4bf",
  size: 6,
};

function getClosedPathData(pathCommands) {
  if (!Array.isArray(pathCommands) || pathCommands.length === 0) {
    return pathCommands;
  }

  const nextPath = [...pathCommands];
  const lastCommand = nextPath[nextPath.length - 1]?.[0];

  if (lastCommand !== "Z" && lastCommand !== "z") {
    nextPath.push(["Z"]);
  }

  return nextPath;
}

export default class DrawTool {
  constructor({ canvas, fabric, getSourceObject, onObjectCreated, onRequestToolChange, onWarning }) {
    this.canvas = canvas;
    this.fabric = fabric;
    this.getSourceObject = getSourceObject;
    this.onObjectCreated = onObjectCreated;
    this.onRequestToolChange = onRequestToolChange;
    this.onWarning = onWarning;
    this.options = { ...DEFAULT_DRAW_OPTIONS };
    this.sourceObject = null;
    this.isProcessing = false;
    this.pathCreatedHandler = null;
  }

  activate(options = {}) {
    if (!this.canvas) {
      return false;
    }

    this.sourceObject = this.getSourceObject?.() || null;
    this.options = {
      ...this.options,
      ...options,
    };

    this.canvas.selection = false;
    this.canvas.discardActiveObject();
    setCanvasObjectInteractivity(this.canvas, false);
    this.canvas.freeDrawingBrush = new this.fabric.PencilBrush(this.canvas);
    this.applyBrushOptions();
    applyCanvasCursor(this.canvas, getDrawCursor());
    this.canvas.isDrawingMode = true;

    this.pathCreatedHandler = (event) => {
      void this.handlePathCreated(event);
    };

    this.canvas.on("path:created", this.pathCreatedHandler);
    return true;
  }

  deactivate() {
    if (this.pathCreatedHandler) {
      this.canvas.off("path:created", this.pathCreatedHandler);
      this.pathCreatedHandler = null;
    }

    this.canvas.isDrawingMode = false;
    setCanvasObjectInteractivity(this.canvas, true);
    this.sourceObject = null;
    this.isProcessing = false;
  }

  updateOptions(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    };

    this.applyBrushOptions();
  }

  applyBrushOptions() {
    if (!this.canvas.freeDrawingBrush) {
      return;
    }

    this.canvas.freeDrawingBrush.color = this.options.color || DEFAULT_DRAW_OPTIONS.color;
    this.canvas.freeDrawingBrush.width = this.options.size || DEFAULT_DRAW_OPTIONS.size;
  }

  async handlePathCreated(event) {
    if (this.isProcessing || !event.path) {
      return;
    }

    const sourceObject = this.resolveSourceObject();

    event.path.set({
      excludeFromLayer: true,
      erasable: false,
    });

    const sourceBounds = normalizeCanvasRect(sourceObject?.getBoundingRect(true, true));
    const pathBounds = normalizeCanvasRect(event.path.getBoundingRect(true, true));
    const exportRegion = getRectIntersection(pathBounds, sourceBounds);

    this.canvas.remove(event.path);
    this.canvas.isDrawingMode = false;

    if (!sourceObject) {
      this.onWarning?.("Select an image object before using Draw.");
      this.onRequestToolChange?.("select");
      return;
    }

    if (!exportRegion || exportRegion.width < 1 || exportRegion.height < 1) {
      this.onWarning?.("Draw over the selected image to duplicate that shape.");
      this.onRequestToolChange?.("select");
      return;
    }

    const clipPath = new this.fabric.Path(getClosedPathData(event.path.path), {
      left: event.path.left,
      top: event.path.top,
      scaleX: event.path.scaleX,
      scaleY: event.path.scaleY,
      angle: event.path.angle,
      skewX: event.path.skewX,
      skewY: event.path.skewY,
      originX: event.path.originX,
      originY: event.path.originY,
      pathOffset: event.path.pathOffset,
      fill: "#ffffff",
      stroke: "#ffffff",
      strokeWidth: event.path.strokeWidth || this.options.size,
      strokeLineCap: event.path.strokeLineCap || "round",
      strokeLineJoin: event.path.strokeLineJoin || "round",
      absolutePositioned: true,
      selectable: false,
      evented: false,
      erasable: false,
      objectCaching: false,
    });

    this.isProcessing = true;

    try {
      const cutImage = await createRasterObjectFromRegion({
        fabric: this.fabric,
        canvas: this.canvas,
        sourceObject,
        region: exportRegion,
        clipPath,
      });

      assignObjectMeta(cutImage, getNextObjectName(this.canvas, "Cut"), "cut", {
        forceNewId: true,
      });
      this.onWarning?.("");
      this.onObjectCreated?.(cutImage);
    } catch (error) {
      console.error("Draw tool failed:", error);
      this.onWarning?.("Draw duplicate failed. Please try again.");
    } finally {
      this.isProcessing = false;
      this.onRequestToolChange?.("select");
    }
  }

  resolveSourceObject() {
    if (this.sourceObject && this.canvas.getObjects().includes(this.sourceObject)) {
      return this.sourceObject;
    }

    return this.getSourceObject?.() || null;
  }
}
