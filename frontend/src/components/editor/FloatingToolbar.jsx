import { useState, useEffect, useRef } from "react";
import { 
  RotateCw, 
  FlipHorizontal, 
  Group, 
  Ungroup, 
  Trash2, 
  Copy, 
  Download,
  WandSparkles,
  Crop,
  Brush,
  Eraser
} from "lucide-react";
import { removeBackground } from "../../utils/imageHelpers.js";

export default function FloatingToolbar({ selectedObject, canvas, onUpdate, onGroup, onUngroup, onDelete, onDuplicate, onSelectTool, activeTool }) {
  const toolbarRef = useRef(null);
  const [isRemovingBG, setIsRemovingBG] = useState(false);

  // Calculate toolbar position
  const getToolbarPosition = () => {
    if (!selectedObject || !canvas) return { top: 0, left: 0 };

    const bounds = selectedObject.getBoundingRect();
    const canvasElement = canvas.getElement();
    const canvasRect = canvasElement.getBoundingClientRect();

    // Convert canvas coordinates to viewport coordinates
    const viewportTop = canvasRect.top + bounds.top - 60;
    const viewportLeft = canvasRect.left + bounds.left + bounds.width / 2;

    return {
      top: viewportTop,
      left: viewportLeft,
    };
  };

  const position = getToolbarPosition();

  // Handle rotate
  const handleRotate = () => {
    if (!selectedObject) return;
    
    selectedObject.rotate(selectedObject.angle + 10);
    canvas.renderAll();
    onUpdate?.();
  };

  // Handle flip
  const handleFlip = () => {
    if (!selectedObject) return;
    
    selectedObject.set("flipX", !selectedObject.flipX);
    canvas.renderAll();
    onUpdate?.();
  };

  // Handle group/ungroup
  const handleGroupToggle = () => {
    if (!selectedObject) return;
    
    if (selectedObject.type === 'activeSelection' || (selectedObject.type !== 'group' && canvas.getActiveObjects().length > 1)) {
      onGroup?.();
    } else if (selectedObject.type === 'group') {
      onUngroup?.();
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (!selectedObject) return;
    onDelete?.();
  };

  // Handle duplicate
  const handleDuplicate = () => {
    if (!selectedObject) return;
    onDuplicate?.();
  };

  // Handle remove background
  const handleRemoveBG = async () => {
    if (!selectedObject || selectedObject.type !== 'image' || isRemovingBG) return;

    setIsRemovingBG(true);

    try {
      // Convert fabric image to dataURL, then to blob
      const dataURL = selectedObject.toDataURL({
        format: "png",
        multiplier: 1,
      });

      // Convert dataURL to blob
      const blob = await new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/png');
        };
        
        img.src = dataURL;
      });

      // Create File from blob
      const imageFile = new File([blob], "image.png", { type: "image/png" });

      // Use existing removeBackground function with correct API URL
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const processedBlob = await removeBackground(imageFile, API_URL);

      // Create URL for processed image
      const processedUrl = URL.createObjectURL(processedBlob);

      // Load processed image back to canvas
      const { fabric } = await import('fabric');
      
      fabric.Image.fromURL(processedUrl, (processedImage) => {
        // Copy all properties from original image
        processedImage.set({
          left: selectedObject.left,
          top: selectedObject.top,
          scaleX: selectedObject.scaleX,
          scaleY: selectedObject.scaleY,
          angle: selectedObject.angle,
          originX: selectedObject.originX,
          originY: selectedObject.originY,
          selectable: true,
          evented: true,
        });

        // Copy editor metadata
        if (selectedObject.editorId) {
          processedImage.editorId = selectedObject.editorId;
        }
        if (selectedObject.name) {
          processedImage.name = selectedObject.name;
        }

        // Replace image
        canvas.remove(selectedObject);
        canvas.add(processedImage);
        canvas.setActiveObject(processedImage);
        canvas.requestRenderAll();

        // Clean up URL
        URL.revokeObjectURL(processedUrl);

        // Notify parent
        onUpdate?.();
      });

    } catch (error) {
      console.error("Remove BG failed:", error);
    } finally {
      setIsRemovingBG(false);
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!selectedObject) return;
    
    // Create a temporary canvas with just the selected object
    const tempCanvas = new fabric.Canvas(null, {
      width: selectedObject.width * (selectedObject.scaleX || 1),
      height: selectedObject.height * (selectedObject.scaleY || 1),
    });
    
    // Clone the selected object
    selectedObject.clone((clonedObj) => {
      // Reset position to top-left corner
      clonedObj.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
      });
      
      tempCanvas.add(clonedObj);
      tempCanvas.renderAll();
      
      // Download the canvas as image
      const dataURL = tempCanvas.toDataURL({
        format: 'png',
        multiplier: 2,
      });
      
      const link = document.createElement('a');
      link.download = `${selectedObject.editorName || 'object'}.png`;
      link.href = dataURL;
      link.click();
      
      tempCanvas.dispose();
    });
  };

  // Handle tool shortcuts
  const handleCropTool = () => {
    onSelectTool?.('crop');
  };

  const handleDrawTool = () => {
    onSelectTool?.('draw');
  };

  const handleEraserTool = () => {
    onSelectTool?.('eraser');
  };

  if (!selectedObject) return null;

  // Check if group button should show as ungroup
  const isGrouped = selectedObject.type === 'group';
  const canGroup = selectedObject.type === 'activeSelection' || canvas.getActiveObjects().length > 1;
  
  // Check if remove background should show (only for images)
  const canRemoveBG = selectedObject.type === 'image';

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 bg-[#111827] backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-slate-600"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Rotate Button */}
      <button
        onClick={handleRotate}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Rotate"
      >
        <RotateCw size={16} />
      </button>

      {/* Flip Button */}
      <button
        onClick={handleFlip}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Flip Horizontal"
      >
        <FlipHorizontal size={16} />
      </button>

      {/* Group/Ungroup Button */}
      {(canGroup || isGrouped) && (
        <button
          onClick={handleGroupToggle}
          className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
          title={isGrouped ? "Ungroup" : "Group"}
        >
          {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
        </button>
      )}

      {/* Remove Background Button */}
      {canRemoveBG && (
        <button
          onClick={handleRemoveBG}
          disabled={isRemovingBG}
          className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-purple-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Remove Background"
        >
          {isRemovingBG ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <WandSparkles size={16} />
          )}
        </button>
      )}

      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-red-600 rounded transition-colors"
        title="Delete"
      >
        <Trash2 size={16} />
      </button>

      {/* Duplicate Button */}
      <button
        onClick={handleDuplicate}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Duplicate"
      >
        <Copy size={16} />
      </button>

      {/* Download Button */}
      <button
        onClick={handleDownload}
        className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
        title="Download"
      >
        <Download size={16} />
      </button>

      {/* Tool Shortcuts Divider */}
      <div className="w-px h-6 bg-slate-600 mx-1" />

      {/* Crop Tool Button */}
      <button
        onClick={handleCropTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'crop' 
            ? 'text-white bg-green-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Crop Tool"
      >
        <Crop size={16} />
      </button>

      {/* Draw Tool Button */}
      <button
        onClick={handleDrawTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'draw' 
            ? 'text-white bg-blue-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Draw Tool"
      >
        <Brush size={16} />
      </button>

      {/* Eraser Tool Button */}
      <button
        onClick={handleEraserTool}
        className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
          activeTool === 'eraser' 
            ? 'text-white bg-orange-600' 
            : 'text-slate-300 hover:text-white hover:bg-slate-600'
        }`}
        title="Eraser Tool"
      >
        <Eraser size={16} />
      </button>
    </div>
  );
}
