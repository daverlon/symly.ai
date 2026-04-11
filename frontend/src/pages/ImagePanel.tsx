import { useEffect, useState } from "react";
import { Expand } from "lucide-react";
import type { SessionImage } from "../api/imageApi";

interface ImagePanelProps {
    images: SessionImage[];
    onSelect: (blobUrl: string) => void;
    onAddToDesk: (image: SessionImage) => void;
}

export default function ImagePanel({ images, onSelect, onAddToDesk }: ImagePanelProps) {
    const [urls, setUrls] = useState<Record<string, string>>({}); // map filename -> blob URL

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

    return (
        <div className="flex gap-2 overflow-x-auto p-2 border-t border-slate-200 bg-white/80">
            {images.map((img) => (
                <div key={img.name} className="relative group w-20 h-20 flex-shrink-0">
                    {/* Click image to add to desk */}
                    <img
                        src={urls[img.name] || ""}
                        alt={img.name}
                        className="w-20 h-20 object-cover rounded cursor-pointer border border-slate-300 hover:border-blue-500"
                        onClick={() => onAddToDesk(img)}
                    />
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
    );
}