import {
  applyCanvasCursor,
  assignObjectMeta,
  getDrawCursor,
  getNextObjectName,
  getRectIntersection,
  normalizeCanvasRect,
  setCanvasObjectInteractivity,
  setCanvasObjectSelection,
} from "../utils/fabricHelpers.js";

const DEFAULT_DRAW_OPTIONS = {
  color: "#2dd4bf",
  size: 6,
};

function getImageSourceUrl(image) {
  if (!image) {
    return "";
  }

  if (typeof image.getSrc === "function") {
    return image.getSrc();
  }

  return image._element?.currentSrc || image._element?.src || "";
}

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

function cloneFabricObject(object) {
  return new Promise((resolve, reject) => {
    if (!object || typeof object.clone !== "function") {
      reject(new Error("Object cannot be cloned."));
      return;
    }

    try {
      const result = object.clone((clonedObject) => resolve(clonedObject));

      if (result?.then) {
        result.then(resolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export default class DrawTool {
  constructor({ canvas, fabric, findImageTargetUnderCursor, onObjectCreated, onRequestToolChange, onWarning }) {
    this.canvas = canvas;
    this.fabric = fabric;
    this.findImageTargetUnderCursor = findImageTargetUnderCursor;
    this.onObjectCreated = onObjectCreated;
    this.onRequestToolChange = onRequestToolChange;
    this.onWarning = onWarning;
    this.options = { ...DEFAULT_DRAW_OPTIONS };
    this.isProcessing = false;
    this.pathCreatedHandler = null;
  }

  activate(options = {}) {
    if (!this.canvas) {
      return false;
    }

    this.options = {
      ...this.options,
      ...options,
    };

    this.canvas.selection = false;
    setCanvasObjectSelection(this.canvas, false);
    this.canvas.freeDrawingBrush = new this.fabric.PencilBrush(this.canvas);
    this.applyBrushOptions();
    applyCanvasCursor(this.canvas, getDrawCursor());
    this.canvas.isDrawingMode = true;

    this.canvas.off("path:created");
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
    const path = event.path;
    if (this.isProcessing || !path) {
      return;
    }

    this.canvas.remove(path);

    const image = this.canvas.getActiveObject();
    if (!image || image.type !== "image" || !image._element) {
      this.onWarning?.("Select an image before using Draw.");
      this.canvas.requestRenderAll();
      return;
    }

    const drawBounds = normalizeCanvasRect(path.getBoundingRect());
    const imageBounds = normalizeCanvasRect(image.getBoundingRect(true, true));
    const bounds = getRectIntersection(drawBounds, imageBounds);

    if (!bounds) {
      this.canvas.requestRenderAll();
      return;
    }

    const sourceUrl = getImageSourceUrl(image);

    if (!sourceUrl && !image._element) {
      this.onWarning?.("Draw could not read the selected image source.");
      this.canvas.requestRenderAll();
      return;
    }

    this.isProcessing = true;

    try {
      const dataUrl = await this.createClippedImageDataUrl({
        image,
        path,
        bounds,
      });

      if (!dataUrl || dataUrl.length < 100) {
        console.error("Invalid dataURL");
        this.onWarning?.("Draw created an empty image. Please try again.");
        return;
      }

      this.fabric.Image.fromURL(dataUrl, (img) => {
        if (!img || !img.width || !img.height) {
          console.error("Image has no dimensions");
          this.onWarning?.("Draw image has no dimensions. Please try again.");
          return;
        }

        img.set({
          left: bounds.left,
          top: bounds.top,
          originX: "left",
          originY: "top",
          selectable: true,
          evented: true,
          erasable: true,
          visible: true,
          opacity: 1,
        });
        img.setCoords();

        assignObjectMeta(img, getNextObjectName(this.canvas, "Draw"), "draw", {
          forceNewId: true,
        });

        this.onWarning?.("");
        this.onObjectCreated?.(img);
        this.onRequestToolChange?.("select");
      });
    } catch (error) {
      console.error("Draw tool failed:", error);
      this.onWarning?.("Draw duplicate failed. Please try again.");
    } finally {
      this.isProcessing = false;
    }
  }

  resolveSourceObject() {
    return this.canvas?.getActiveObject() || null;
  }

  async createClippedImageDataUrl({ image, path, bounds }) {
    const tempWidth = Math.max(1, Math.ceil(this.canvas.getWidth()));
    const tempHeight = Math.max(1, Math.ceil(this.canvas.getHeight()));
    const imageCanvasElement = document.createElement("canvas");
    const maskCanvasElement = document.createElement("canvas");

    imageCanvasElement.width = tempWidth;
    imageCanvasElement.height = tempHeight;
    maskCanvasElement.width = tempWidth;
    maskCanvasElement.height = tempHeight;

    const tempCanvas = new this.fabric.StaticCanvas(imageCanvasElement, {
      width: tempWidth,
      height: tempHeight,
      backgroundColor: "transparent",
      renderOnAddRemove: false,
    });
    const maskCanvas = new this.fabric.StaticCanvas(maskCanvasElement, {
      width: tempWidth,
      height: tempHeight,
      backgroundColor: "transparent",
      renderOnAddRemove: false,
    });
    const clonedImage = await cloneFabricObject(image);
    const maskPath = new this.fabric.Path(getClosedPathData(path.path), {
      left: path.left,
      top: path.top,
      scaleX: path.scaleX,
      scaleY: path.scaleY,
      angle: path.angle,
      skewX: path.skewX,
      skewY: path.skewY,
      originX: path.originX,
      originY: path.originY,
      pathOffset: path.pathOffset,
      fill: "#ffffff",
      stroke: "#ffffff",
      strokeWidth: path.strokeWidth || this.options.size,
      strokeLineCap: path.strokeLineCap || "round",
      strokeLineJoin: path.strokeLineJoin || "round",
      selectable: false,
      evented: false,
      erasable: false,
      objectCaching: false,
    });

    try {
      clonedImage.set({
        left: image.left,
        top: image.top,
        originX: image.originX,
        originY: image.originY,
        scaleX: image.scaleX || 1,
        scaleY: image.scaleY || 1,
        angle: image.angle || 0,
        skewX: image.skewX || 0,
        skewY: image.skewY || 0,
        flipX: image.flipX || false,
        flipY: image.flipY || false,
        selectable: false,
        evented: false,
        visible: true,
        opacity: 1,
        objectCaching: false,
      });
      clonedImage.setCoords();

      tempCanvas.add(clonedImage);
      tempCanvas.renderAll();

      maskCanvas.add(maskPath);
      maskCanvas.renderAll();

      const context = tempCanvas.getContext();

      if (!context) {
        throw new Error("Draw export canvas has no 2D context.");
      }

      context.save();
      context.globalCompositeOperation = "destination-in";
      context.drawImage(maskCanvasElement, 0, 0);
      context.restore();

      if (!this.hasVisiblePixels(tempCanvas, bounds)) {
        throw new Error("Draw export contains no visible pixels.");
      }

      return this.exportNativeCanvasRegion(imageCanvasElement, bounds);
    } finally {
      tempCanvas.dispose();
      maskCanvas.dispose();
    }
  }

  hasVisiblePixels(tempCanvas, bounds) {
    const context = tempCanvas.getContext();
    if (!context) {
      return false;
    }

    const left = Math.max(0, Math.floor(bounds.left));
    const top = Math.max(0, Math.floor(bounds.top));
    const width = Math.max(1, Math.ceil(bounds.width));
    const height = Math.max(1, Math.ceil(bounds.height));
    const pixels = context.getImageData(left, top, width, height).data;

    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        return true;
      }
    }

    return false;
  }

  exportNativeCanvasRegion(sourceCanvas, bounds) {
    const left = Math.max(0, Math.floor(bounds.left));
    const top = Math.max(0, Math.floor(bounds.top));
    const width = Math.max(1, Math.ceil(bounds.width));
    const height = Math.max(1, Math.ceil(bounds.height));
    const outputCanvas = document.createElement("canvas");
    const outputContext = outputCanvas.getContext("2d");

    if (!outputContext) {
      throw new Error("Draw output canvas has no 2D context.");
    }

    outputCanvas.width = width;
    outputCanvas.height = height;
    outputContext.drawImage(sourceCanvas, left, top, width, height, 0, 0, width, height);

    return outputCanvas.toDataURL("image/png");
  }
}
