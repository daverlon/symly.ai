import { useEffect } from "react";

export function useEscapeKeyHandler(
    previewImage: string | null,
    setPreviewImage: React.Dispatch<React.SetStateAction<string | null>>,
    imagePanelOpen: boolean,
    setImagePanelOpen: React.Dispatch<React.SetStateAction<boolean>>,
    chatOpen: boolean,
    onCloseChat: () => void,
    selectedIndex: number | null,
    setSelectedIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (previewImage) {
                setPreviewImage(null);
            } else if (imagePanelOpen) {
                setImagePanelOpen(false);
            } else if (chatOpen) {
                onCloseChat();
            } else if (selectedIndex !== null) {
                setSelectedIndex(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [previewImage, imagePanelOpen, chatOpen, selectedIndex, setPreviewImage, setImagePanelOpen, onCloseChat, setSelectedIndex]);
}
