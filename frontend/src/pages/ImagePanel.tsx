import { useEffect, useState } from "react";
import type { SessionImage } from "../api/imageApi";

interface ImagePanelProps {
    images: SessionImage[];
    onSelect: (image: SessionImage) => void;
}

export default function ImagePanel({ images, onSelect }: ImagePanelProps) {
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
                <img
                    key={img.name}
                    src={urls[img.name] ?? null}
                    alt={img.name}
                    className="w-20 h-20 object-cover rounded cursor-pointer border border-slate-300 hover:border-blue-500"
                    onClick={() => onSelect?.(img)}
                />
            ))}
        </div>
    );
}