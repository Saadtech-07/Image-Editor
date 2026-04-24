let fallbackId = 0;

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
  });

  return fabricObject;
}

export function getLayerObjects(canvas) {
  if (!canvas) {
    return [];
  }

  const layerObjects = canvas
    .getObjects()
    .filter((fabricObject) => !fabricObject.excludeFromLayer);

  layerObjects.forEach((fabricObject, index) => {
    assignObjectMeta(fabricObject, fabricObject.editorName || `Object ${index + 1}`, fabricObject.editorKind || fabricObject.type);
  });

  return [...layerObjects].reverse().map((fabricObject, index) => ({
    id: fabricObject.editorId,
    name: fabricObject.editorName || `Object ${layerObjects.length - index}`,
    type: fabricObject.editorKind || fabricObject.type || "object",
    visible: fabricObject.visible !== false,
    fabricObject,
  }));
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
    try {
      const cloneResult = fabricObject.clone((clonedObject) => resolve(clonedObject));

      if (cloneResult?.then) {
        cloneResult.then(resolve).catch(reject);
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
