import { useState, useEffect, useRef } from "react";
import { RotateCw, FlipHorizontal, Square } from "lucide-react";

export default function FloatingToolbar({ selectedObject, canvas, onUpdate }) {
  const [cornerRadius, setCornerRadius] = useState(0);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const toolbarRef = useRef(null);

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

  // Handle corner radius
  const handleCornerRadius = (radius) => {
    if (!selectedObject) return;

    setCornerRadius(radius);

    if (selectedObject.type === 'image') {
      // Calculate actual dimensions
      const actualWidth = selectedObject.width * selectedObject.scaleX;
      const actualHeight = selectedObject.height * selectedObject.scaleY;
      
      // Convert percentage to actual radius
      // For 100% to create a circle, use half of the smaller dimension
      const maxRadius = Math.min(actualWidth, actualHeight) / 2;
      const finalRadius = (radius / 100) * maxRadius;
      
      // Remove existing clipPath if any
      if (selectedObject.clipPath) {
        selectedObject.clipPath = null;
      }
      
      // Create rounded rectangle clipPath
      const clipPath = new fabric.Rect({
        width: actualWidth,
        height: actualHeight,
        rx: finalRadius,
        ry: finalRadius,
        originX: "center",
        originY: "center",
        absolutePositioned: false,
      });
      
      selectedObject.clipPath = clipPath;
    } else if (selectedObject.type === 'rect') {
      // For rectangles, use rx/ry properties
      const actualWidth = selectedObject.width * selectedObject.scaleX;
      const actualHeight = selectedObject.height * selectedObject.scaleY;
      const maxRadius = Math.min(actualWidth, actualHeight) / 2;
      const finalRadius = (radius / 100) * maxRadius;
      
      selectedObject.set({
        rx: finalRadius,
        ry: finalRadius,
      });
    }

    canvas.renderAll();
    onUpdate?.();
  };

  // Close radius slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setShowRadiusSlider(false);
      }
    };

    if (showRadiusSlider) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRadiusSlider]);

  if (!selectedObject) return null;

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

      {/* Corner Radius Button */}
      <div className="relative">
        <button
          onClick={() => setShowRadiusSlider(!showRadiusSlider)}
          className="flex items-center justify-center w-8 h-8 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
          title="Corner Radius"
        >
          <Square size={16} />
        </button>

        {/* Radius Slider Popup */}
        {showRadiusSlider && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-[#111827] border border-slate-600 rounded-lg shadow-lg p-3 w-48">
            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium">Corner Radius</label>
              <input
                type="range"
                min="0"
                max="100"
                value={cornerRadius}
                onChange={(e) => handleCornerRadius(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <div className="text-xs text-slate-400 text-center">{cornerRadius}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
