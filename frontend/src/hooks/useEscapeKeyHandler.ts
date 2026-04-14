import { useEffect } from "react";

export function useEscapeKeyHandler(

    previewImage: string | null,
    setPreviewImage: React.Dispatch<React.SetStateAction<string | null>>,

    imagePanelOpen: boolean,
    setImagePanelOpen: React.Dispatch<React.SetStateAction<boolean>>,

    selectedIndex: number | null,
    setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>

) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (previewImage)
                    setPreviewImage(null);
                else if (imagePanelOpen)
                    setImagePanelOpen(false);
                else if (selectedIndex)
                    setSelectedIndex(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [previewImage, imagePanelOpen, setSelectedIndex]);
}