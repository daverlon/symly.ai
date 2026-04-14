import { useEffect } from "react";
import type { DeskImage } from "../api/imageApi";

export function useMouseDrag(

    deskScrollRef: React.RefObject<HTMLDivElement | null>,
    deskImages: DeskImage[]

) {

    useEffect(() => {
        const el = deskScrollRef.current;
        if (!el) return;

        let isMiddleDragging = false;
        let startX = 0;
        let scrollLeft = 0;

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 1) return;
            e.preventDefault();
            isMiddleDragging = true;
            startX = e.pageX;
            scrollLeft = el.scrollLeft;
            el.style.cursor = "grabbing";
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isMiddleDragging) return;
            const dx = e.pageX - startX;
            el.scrollLeft = scrollLeft - dx;
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button !== 1) return;
            isMiddleDragging = false;
            el.style.cursor = "";
        };

        el.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            el.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [deskImages]);

}