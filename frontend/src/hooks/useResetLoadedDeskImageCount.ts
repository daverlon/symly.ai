import { useEffect } from "react"
import type { DeskImage } from "../api/imageApi";


export function useResetLoadedDeskImageCount(
    deskImagesLoadedCount: React.RefObject<number>,
    deskImages: DeskImage[],
) {
    useEffect(() => {
        deskImagesLoadedCount.current = 0;
    }, [deskImages.length]);
}