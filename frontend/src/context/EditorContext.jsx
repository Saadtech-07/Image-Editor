import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getLayerObjects } from "../utils/fabricHelpers.js";

const EditorContext = createContext(null);

export function EditorProvider({ children }) {
  const canvasRef = useRef(null);
  const [canvas, setCanvasState] = useState(null);
  const [objects, setObjects] = useState([]);
  const [activeObject, setActiveObject] = useState(null);

  const setCanvas = useCallback((canvasInstance) => {
    canvasRef.current = canvasInstance;
    setCanvasState(canvasInstance);

    if (!canvasInstance) {
      setObjects([]);
      setActiveObject(null);
    }
  }, []);

  const syncObjects = useCallback(
    (targetCanvas) => {
      const sourceCanvas = targetCanvas || canvasRef.current;

      if (!sourceCanvas) {
        setObjects([]);
        return;
      }

      setObjects(getLayerObjects(sourceCanvas));
    },
    [],
  );

  const selectObjectById = useCallback(
    (objectId) => {
      if (!canvas) {
        return;
      }

      const fabricObject = canvas.getObjects().find((object) => object.editorId === objectId);

      if (!fabricObject) {
        return;
      }

      canvas.setActiveObject(fabricObject);
      setActiveObject(fabricObject);
      canvas.requestRenderAll();
      syncObjects(canvas);
    },
    [canvas, syncObjects],
  );

  const value = useMemo(
    () => ({
      canvas,
      setCanvas,
      objects,
      setObjects,
      syncObjects,
      activeObject,
      setActiveObject,
      selectObjectById,
    }),
    [activeObject, canvas, objects, selectObjectById, setCanvas, syncObjects],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error("useEditor must be used inside EditorProvider.");
  }

  return context;
}
