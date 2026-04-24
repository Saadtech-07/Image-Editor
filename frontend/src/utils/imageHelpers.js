export function ensureImageFile(source, fallbackName = "upload.png") {
  if (source instanceof File) {
    return source;
  }

  if (source instanceof Blob) {
    return new File([source], fallbackName, {
      type: source.type || "image/png",
    });
  }

  throw new Error("Expected an image File or Blob before uploading.");
}

export async function removeBackground(originalFile, apiUrl) {
  const imageFile = ensureImageFile(originalFile);
  const formData = new FormData();
  formData.append("image", imageFile, imageFile.name || "upload.png");

  const response = await fetch(`${apiUrl}/remove-bg`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Background removal failed.";

    try {
      const payload = await response.json();
      message = payload.details || payload.message || message;
    } catch {
      message = await response.text();
    }

    throw new Error(message);
  }

  return response.blob();
}
