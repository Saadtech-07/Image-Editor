import { applyCanvasCursor, getEraserCursor, setCanvasObjectInteractivity } from "../utils/fabricHelpers.js";

const DEFAULT_ERASER_OPTIONS = {
  size: 24,
  inverted: false,
};

export default class EraserTool {
  constructor({ canvas, fabric, onCanvasMutation, onWarning }) {
    this.canvas = canvas;
    this.fabric = fabric;
    this.onCanvasMutation = onCanvasMutation;
    this.onWarning = onWarning;
    this.options = { ...DEFAULT_ERASER_OPTIONS };
    this.erasingEndHandler = null;
  }

  activate(options = {}) {
    if (!this.canvas) {
      return false;
    }

    if (typeof this.fabric.EraserBrush !== "function") {
      this.onWarning?.(
        "EraserBrush is not available in this Fabric build. Use the Fabric custom build with erasing support from fabric5.fabricjs.com.",
      );
      return false;
    }

    this.options = {
      ...this.options,
      ...options,
    };

    this.canvas.selection = false;
    this.canvas.discardActiveObject();
    setCanvasObjectInteractivity(this.canvas, false);

    const brush = new this.fabric.EraserBrush(this.canvas);
    brush.width = this.options.size || DEFAULT_ERASER_OPTIONS.size;
    brush.inverted = Boolean(this.options.inverted);

    this.canvas.freeDrawingBrush = brush;
    this.canvas.isDrawingMode = true;
    applyCanvasCursor(this.canvas, getEraserCursor(brush.width));

    this.erasingEndHandler = () => {
      this.onCanvasMutation?.();
    };

    this.canvas.on("erasing:end", this.erasingEndHandler);
    return true;
  }

  deactivate() {
    if (this.erasingEndHandler) {
      this.canvas.off("erasing:end", this.erasingEndHandler);
      this.erasingEndHandler = null;
    }

    this.canvas.isDrawingMode = false;
    setCanvasObjectInteractivity(this.canvas, true);
  }

  updateOptions(options = {}) {
    this.options = {
      ...this.options,
      ...options,
    };

    if (!this.canvas.freeDrawingBrush) {
      return;
    }

    this.canvas.freeDrawingBrush.width = this.options.size || DEFAULT_ERASER_OPTIONS.size;
    this.canvas.freeDrawingBrush.inverted = Boolean(this.options.inverted);
    applyCanvasCursor(this.canvas, getEraserCursor(this.canvas.freeDrawingBrush.width));
    this.canvas.requestRenderAll();
  }
}
