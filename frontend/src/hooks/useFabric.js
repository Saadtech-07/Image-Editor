import { useEffect, useRef } from "react";
import { fabric } from "fabric";
import { useEditor } from "../context/EditorContext.jsx";
import { assignObjectMeta, fitImageToCanvas } from "../utils/fabricHelpers.js";

export default function useFabric(canvasElementRef, imageUrl) {
  const fabricCanvasRef = useRef(null);
  const { setCanvas, setActiveObject, syncObjects } = useEditor();

  useEffect(() => {
    if (!canvasElementRef.current || fabricCanvasRef.current) {
      return undefined;
    }

    const canvas = new fabric.Canvas(canvasElementRef.current, {
      width: 980,
      height: 660,
      backgroundColor: "#0f172a",
      preserveObjectStacking: true,
      selection: true,
      fireRightClick: false,
    });

    fabricCanvasRef.current = canvas;
    setCanvas(canvas);

    const handleSelection = () => {
      setActiveObject(canvas.getActiveObject() || null);
      syncObjects(canvas);
    };

    const handleMutation = () => {
      syncObjects(canvas);
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    canvas.on("object:added", handleMutation);
    canvas.on("object:removed", handleMutation);
    canvas.on("object:modified", handleMutation);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      canvas.off("object:added", handleMutation);
      canvas.off("object:removed", handleMutation);
      canvas.off("object:modified", handleMutation);
      canvas.dispose();
      fabricCanvasRef.current = null;
      setCanvas(null);
    };
  }, [canvasElementRef, setActiveObject, setCanvas, syncObjects]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;

    if (!canvas || !imageUrl) {
      return undefined;
    }

    let isCancelled = false;
    canvas.clear();
    canvas.setBackgroundColor("#0f172a", canvas.requestRenderAll.bind(canvas));

    fabric.Image.fromURL(imageUrl, (image) => {
      if (isCancelled) {
        return;
      }

      assignObjectMeta(image, "Base Image", "image");
      image.set({
        selectable: true,
        evented: true,
        hasControls: true,
      });
      fitImageToCanvas(image, canvas);
      canvas.add(image);
      canvas.setActiveObject(image);
      setActiveObject(image);
      canvas.requestRenderAll();
      syncObjects(canvas);
    });

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, setActiveObject, syncObjects]);

  return fabricCanvasRef;
}
