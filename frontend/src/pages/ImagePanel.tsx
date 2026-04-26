import { useEffect, useRef, useState } from "react";
import { Expand, Plus, Loader2 } from "lucide-react";
import type { DeskImage, SessionImage } from "../api/imageApi";
import { uploadImageFile } from "../api/imageApi";
import { createUploadSessionKey } from "../api/sessionsApi";

interface ImagePanelProps {
    sessionId: string | null;
    images: SessionImage[];
    onSelect: (blobUrl: string) => void;
    onAddToDesk: (image: DeskImage) => void;
}

function sessionImageToDeskImage(si: SessionImage): DeskImage {
    return {
        name: si.name,
        position: -1,
        uid: "",  // replaced with server-assigned uid after addDeskImage resolves
    };
}

export default function ImagePanel({ sessionId, images, onSelect, onAddToDesk }: ImagePanelProps) {
    const [urls, setUrls] = useState<Record<string, string>>({}); // map filename -> blob URL
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const objectUrls: Record<string, string> = {};
        const token = localStorage.getItem("jwt");

        images.forEach(async (img) => {
            const res = await fetch(img.url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!res.ok) return; // skip if error
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            objectUrls[img.name] = url;
            setUrls({ ...objectUrls }); // trigger render
        });

        // cleanup on unmount
        return () => {
            Object.values(objectUrls).forEach(URL.revokeObjectURL);
        };
    }, [images]);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length || !sessionId) return;

        setUploading(true);
        setUploadError(null);

        try {
            const { key } = await createUploadSessionKey(sessionId);
            await Promise.all(files.map((f) => uploadImageFile(key, f)));
        } catch {
            setUploadError("Upload failed — please try again.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    return (
        <div className="flex flex-col gap-0">
            {uploadError && (
                <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-b border-red-100">
                    {uploadError}
                </div>
            )}
            <div className="flex gap-2 overflow-x-auto p-2 border-t border-slate-200 bg-white/80">
            <div
                key="__upload__"
                className={`relative w-20 h-20 flex-shrink-0 rounded border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 ${
                    uploading
                        ? "border-blue-300 bg-blue-50 cursor-default text-blue-400"
                        : "border-slate-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer text-slate-400 hover:text-blue-500"
                }`}
                onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            >
                {uploading ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-[10px] font-medium">Uploading…</span>
                    </>
                ) : (
                    <>
                        <Plus size={20} />
                        <span className="text-[10px] font-medium">Upload</span>
                    </>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
            {images.map((img) => (


                <div key={img.name} className="relative group w-20 h-20 flex-shrink-0">
                    {/* Click image to add to desk */}
                    {img && (<img
                        src={urls[img.name]}
                        alt={img.name}
                        className="w-20 h-20 object-cover rounded cursor-pointer border border-slate-300 hover:border-blue-500"
                        onClick={() => onAddToDesk(sessionImageToDeskImage(img))}
                    />)}
                    {/* Hover button to preview */}
                    <button
                        className="absolute top-1 right-1
                            opacity-0 group-hover:opacity-100
                            transition-opacity duration-150
                            bg-black/60 hover:bg-black/80
                            text-white rounded-full
                            w-6 h-6 flex items-center justify-center"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(urls[img.name]);
                        }}
                    >
                        <Expand size={12} />
                    </button>
                </div>
            ))}
        </div>
        </div>
    );
}