import { useEffect, useRef, useState } from "react";
import { Camera, Upload, RefreshCw, FileImage, ChevronDown } from "lucide-react";
import { Button, Modal, capturePhoto, listCameras } from "@oagf/ui";
import type { CameraDescriptor } from "@oagf/ui";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDescriptor[] | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<number>(0);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCaptured(null);
      setError(null);
      setCameras(null);
      setSelectedCamera(0);
      setLoadingCameras(false);
      setCapturing(false);
      return;
    }

    setLoadingCameras(true);
    listCameras()
      .then((list) => {
        setCameras(list);
        setSelectedCamera(0);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Unable to detect cameras: ${message}. Please upload a photo instead.`);
        setCameras([]);
      })
      .finally(() => setLoadingCameras(false));
  }, [isOpen]);

  async function handleCapture() {
    setError(null);
    setCapturing(true);
    try {
      const result = await capturePhoto(selectedCamera);
      setCaptured(result.data_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Camera capture failed: ${message}. Please upload a photo instead.`);
      console.error("Camera capture error:", err);
    } finally {
      setCapturing(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCaptured(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file.");
    };
    reader.readAsDataURL(file);
  }

  function handleRetake() {
    setCaptured(null);
    setError(null);
  }

  function handleConfirm() {
    if (captured) {
      onCapture(captured);
      setCaptured(null);
      setError(null);
      onClose();
    }
  }

  function handleClose() {
    setCaptured(null);
    setError(null);
    onClose();
  }

  const hasCamera = cameras !== null && cameras.length > 0;
  const noCamera = cameras !== null && cameras.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Capture or Upload Photo" className="max-w-lg">
      <div className="space-y-4">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {captured ? (
            <img src={captured} alt="Captured" className="h-full w-full rounded-lg object-contain" />
          ) : (
            <div className="text-center text-oagf-grey">
              <FileImage size={48} className="mx-auto mb-2" />
              {loadingCameras ? (
                <p>Detecting cameras...</p>
              ) : hasCamera ? (
                <p>Press "Capture Photo" to take a picture.</p>
              ) : (
                <p>No camera detected. Please upload a photo.</p>
              )}
            </div>
          )}
        </div>

        {error && !captured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>
        )}

        {noCamera && !captured && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            No camera found on this device. File upload is enabled.
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        {!captured ? (
          <div className="space-y-3">
            {hasCamera && cameras.length > 1 && (
              <div className="relative">
                <label htmlFor="camera-select" className="mb-1 block text-sm font-medium text-gray-700">
                  Select camera
                </label>
                <div className="relative">
                  <select
                    id="camera-select"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(Number(e.target.value))}
                    className="w-full appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-oagf-green focus:outline-none focus:ring-1 focus:ring-oagf-green"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.index} value={camera.index}>
                        {camera.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload size={16} className="mr-1.5" /> Upload File
              </Button>
              {hasCamera && (
                <Button type="button" onClick={handleCapture} disabled={capturing}>
                  <Camera size={16} className="mr-1.5" />
                  {capturing ? "Capturing..." : "Capture Photo"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={handleRetake}>
              <RefreshCw size={16} className="mr-1.5" /> Retake
            </Button>
            <Button type="button" onClick={handleConfirm}>
              Use Photo
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
