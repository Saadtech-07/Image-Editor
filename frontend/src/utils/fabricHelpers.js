let fallbackId = 0;

export const FABRIC_SERIALIZATION_PROPS = [
  "editorId",
  "editorName",
  "editorKind",
  "excludeFromLayer",
  "erasable",
  "eraser",
];

export function createObjectId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  fallbackId += 1;
  return `object-${Date.now()}-${fallbackId}`;
}

export function assignObjectMeta(fabricObject, name, kind = "object", options = {}) {
  if (options.forceNewId || !fabricObject.editorId) {
    fabricObject.editorId = createObjectId();
  }

  if (name) {
    fabricObject.editorName = name;
  }

  fabricObject.editorKind = kind;
  fabricObject.set({
    borderColor: "#5eead4",
    cornerColor: "#5eead4",
    cornerSize: 10,
    cornerStyle: "circle",
    transparentCorners: false,
    erasable: fabricObject.erasable ?? true,
  });

  return fabricObject;
}

export function copyObjectMeta(sourceObject, targetObject, options = {}) {
  if (!sourceObject || !targetObject) {
    return targetObject;
  }

  targetObject.editorId = options.forceNewId ? createObjectId() : sourceObject.editorId || targetObject.editorId;
  targetObject.editorName = sourceObject.editorName;
  targetObject.editorKind = sourceObject.editorKind;
  targetObject.excludeFromLayer = sourceObject.excludeFromLayer;

  assignObjectMeta(
    targetObject,
    sourceObject.editorName || targetObject.editorName,
    sourceObject.editorKind || targetObject.editorKind || targetObject.type,
    { forceNewId: false },
  );

  targetObject.set({
    visible: sourceObject.visible !== false,
    erasable: sourceObject.erasable ?? true,
  });

  return targetObject;
}

export function getLayerObjects(canvas) {
  if (!canvas) {
    return [];
  }

  const layerObjects = canvas.getObjects().filter((fabricObject) => !fabricObject.excludeFromLayer);

  layerObjects.forEach((fabricObject, index) => {
    assignObjectMeta(
      fabricObject,
      fabricObject.editorName || `Object ${index + 1}`,
      fabricObject.editorKind || fabricObject.type,
    );
  });

  return [...layerObjects].reverse().map((fabricObject, index) => ({
    id: fabricObject.editorId,
    name: fabricObject.editorName || `Object ${layerObjects.length - index}`,
    type: fabricObject.editorKind || fabricObject.type || "object",
    visible: fabricObject.visible !== false,
    fabricObject,
  }));
}

export function isImageObject(fabricObject) {
  return fabricObject?.type === "image";
}

export function getBaseImageObject(canvas) {
  if (!canvas) {
    return null;
  }

  return canvas.getObjects().find((fabricObject) => isImageObject(fabricObject) && !fabricObject.excludeFromLayer) || null;
}

export function getSelectedOrBaseImageObject(canvas) {
  if (!canvas) {
    return null;
  }

  const activeObject = canvas.getActiveObject();

  if (isImageObject(activeObject) && !activeObject.excludeFromLayer) {
    return activeObject;
  }

  return getBaseImageObject(canvas);
}

export function getNextObjectName(canvas, prefix = "Object") {
  if (!canvas) {
    return `${prefix} 1`;
  }

  const count = canvas
    .getObjects()
    .filter((fabricObject) => !fabricObject.excludeFromLayer)
    .filter((fabricObject) => fabricObject.editorName?.startsWith(prefix)).length;

  return `${prefix} ${count + 1}`;
}

export function fitImageToCanvas(image, canvas, padding = 56) {
  const availableWidth = Math.max(canvas.getWidth() - padding * 2, 160);
  const availableHeight = Math.max(canvas.getHeight() - padding * 2, 160);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);

  image.set({
    scaleX: scale,
    scaleY: scale,
    left: (canvas.getWidth() - image.width * scale) / 2,
    top: (canvas.getHeight() - image.height * scale) / 2,
  });
}

export function cloneFabricObject(fabricObject) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const handleResolve = (clonedObject) => {
      if (!resolved) {
        resolved = true;
        resolve(clonedObject);
      }
    };

    try {
      const cloneResult = fabricObject.clone((clonedObject) => handleResolve(clonedObject));

      if (cloneResult?.then) {
        cloneResult.then(handleResolve).catch(reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function removeObjectFromCanvas(canvas, fabricObject) {
  if (!canvas || !fabricObject) {
    return;
  }

  if (fabricObject.type === "activeSelection") {
    fabricObject.getObjects().forEach((object) => canvas.remove(object));
    canvas.discardActiveObject();
    return;
  }

  canvas.remove(fabricObject);
  canvas.discardActiveObject();
}

export function replaceCanvasObject(canvas, sourceObject, nextObject) {
  if (!canvas || !sourceObject || !nextObject) {
    return null;
  }

  const objectIndex = canvas.getObjects().indexOf(sourceObject);

  canvas.remove(sourceObject);
  canvas.insertAt(nextObject, Math.max(objectIndex, 0), false);
  nextObject.setCoords();
  canvas.requestRenderAll();

  return nextObject;
}

export function setCanvasObjectInteractivity(canvas, enabled) {
  if (!canvas) {
    return;
  }

  canvas.getObjects().forEach((fabricObject) => {
    if (!fabricObject.excludeFromLayer) {
      fabricObject.set({
        selectable: enabled,
        evented: enabled,
      });
    }
  });
}

export function normalizeCanvasRect(rect) {
  if (!rect) {
    return null;
  }

  return {
    left: Math.round(rect.left || 0),
    top: Math.round(rect.top || 0),
    width: Math.max(0, Math.round(rect.width || 0)),
    height: Math.max(0, Math.round(rect.height || 0)),
  };
}

export function getRectIntersection(rectA, rectB) {
  if (!rectA || !rectB) {
    return null;
  }

  const left = Math.max(rectA.left, rectB.left);
  const top = Math.max(rectA.top, rectB.top);
  const right = Math.min(rectA.left + rectA.width, rectB.left + rectB.width);
  const bottom = Math.min(rectA.top + rectA.height, rectB.top + rectB.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return normalizeCanvasRect({
    left,
    top,
    width: right - left,
    height: bottom - top,
  });
}

export function doesRectCoverRect(innerRect, outerRect) {
  if (!innerRect || !outerRect) {
    return false;
  }

  return (
    innerRect.left <= outerRect.left &&
    innerRect.top <= outerRect.top &&
    innerRect.left + innerRect.width >= outerRect.left + outerRect.width &&
    innerRect.top + innerRect.height >= outerRect.top + outerRect.height
  );
}

export function loadFabricImageFromUrl(fabricInstance, url) {
  return new Promise((resolve, reject) => {
    fabricInstance.Image.fromURL(url, (image) => {
      if (!image) {
        reject(new Error("Unable to load image."));
        return;
      }

      resolve(image);
    });
  });
}

function encodeSvgCursor(svgMarkup) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}")`;
}

export function getCropCursor() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="3" fill="#f8fafc" fill-opacity="0.85"/>
      <path d="M16 5.5v21M5.5 16h21" stroke="#22d3ee" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `;

  return `${encodeSvgCursor(svg)} 16 16, crosshair`;
}

export function getDrawCursor() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <path d="M7 25.5l2.8-8L19.5 7.8l4.7 4.7-9.7 9.7-7.5 3.3Z" fill="#22d3ee" stroke="#f8fafc" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M18.8 8.5l4.7 4.7" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;

  return `${encodeSvgCursor(svg)} 7 25, crosshair`;
}

export function getEraserCursor(brushSize = 24) {
  const diameter = Math.max(12, Math.round(brushSize));
  const padding = 6;
  const canvasSize = diameter + padding * 2;
  const center = canvasSize / 2;
  const hotspot = Math.round(center);
  const radius = diameter / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="rgba(34,211,238,0.12)" stroke="#f8fafc" stroke-width="1.5"/>
      <circle cx="${center}" cy="${center}" r="${Math.max(radius - 3, 2)}" fill="none" stroke="#22d3ee" stroke-width="1"/>
    </svg>
  `;

  return `${encodeSvgCursor(svg)} ${hotspot} ${hotspot}, crosshair`;
}

export function applyCanvasCursor(canvas, cursor) {
  if (!canvas) {
    return;
  }

  canvas.defaultCursor = cursor;
  canvas.hoverCursor = cursor;
  canvas.moveCursor = cursor;
  canvas.freeDrawingCursor = cursor;

  if (canvas.upperCanvasEl) {
    canvas.upperCanvasEl.style.cursor = cursor;
  }
}

async function cloneCutoutObject(cutoutObject) {
  if (!cutoutObject) {
    return null;
  }

  const clonedCutout = await cloneFabricObject(cutoutObject);

  clonedCutout.set({
    selectable: false,
    evented: false,
    erasable: false,
    objectCaching: false,
  });

  return clonedCutout;
}

export async function createRasterObjectFromRegion({
  fabric: fabricInstance,
  canvas,
  sourceObject,
  region,
  clipPath,
  cutoutObject,
}) {
  const exportRegion = normalizeCanvasRect(region);

  if (!fabricInstance || !canvas || !sourceObject || !exportRegion) {
    throw new Error("Missing raster export input.");
  }

  if (exportRegion.width < 1 || exportRegion.height < 1) {
    throw new Error("Raster export region is too small.");
  }

  const tempCanvasElement = document.createElement("canvas");
  tempCanvasElement.width = Math.ceil(canvas.getWidth());
  tempCanvasElement.height = Math.ceil(canvas.getHeight());

  const tempCanvas = new fabricInstance.StaticCanvas(tempCanvasElement, {
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    backgroundColor: "transparent",
    renderOnAddRemove: false,
  });

  try {
    const clonedSource = await cloneFabricObject(sourceObject);

    clonedSource.set({
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    if (clipPath) {
      const clonedClipPath = await cloneFabricObject(clipPath);

      clonedClipPath.set({
        absolutePositioned: true,
        selectable: false,
        evented: false,
        objectCaching: false,
      });

      clonedSource.set({
        clipPath: clonedClipPath,
      });
    }

    tempCanvas.add(clonedSource);
    tempCanvas.renderAll();

    if (cutoutObject) {
      const cutoutCanvasElement = document.createElement("canvas");
      cutoutCanvasElement.width = Math.ceil(canvas.getWidth());
      cutoutCanvasElement.height = Math.ceil(canvas.getHeight());

      const cutoutCanvas = new fabricInstance.StaticCanvas(cutoutCanvasElement, {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        backgroundColor: "transparent",
        renderOnAddRemove: false,
      });

      try {
        const clonedCutout = await cloneCutoutObject(cutoutObject);

        if (clonedCutout) {
          cutoutCanvas.add(clonedCutout);
          cutoutCanvas.renderAll();

          const context = tempCanvas.getContext();
          context.save();
          context.globalCompositeOperation = "destination-out";
          context.drawImage(cutoutCanvas.lowerCanvasEl, 0, 0);
          context.restore();
        }
      } finally {
        cutoutCanvas.dispose();
      }
    }

    const dataUrl = tempCanvas.toDataURL({
      format: "png",
      left: exportRegion.left,
      top: exportRegion.top,
      width: exportRegion.width,
      height: exportRegion.height,
      multiplier: 1,
    });

    const rasterImage = await loadFabricImageFromUrl(fabricInstance, dataUrl);

    rasterImage.set({
      left: exportRegion.left,
      top: exportRegion.top,
      selectable: true,
      evented: true,
      erasable: true,
    });
    rasterImage.setCoords();

    return rasterImage;
  } finally {
    tempCanvas.dispose();
  }
}
