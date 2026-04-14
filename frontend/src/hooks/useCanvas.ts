import { useEffect } from "react";

export function useCanvas(

    canvasRef: React.RefObject<HTMLCanvasElement | null>, 
    loading: boolean

) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.max(1, window.devicePixelRatio || 1);

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));

            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            // Draw grid
            const spacing = 40;
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
            for (let x = 0; x <= width; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Subtle center glow
            const gradient = ctx.createRadialGradient(
                width * 0.55,
                height * 0.35,
                0,
                width * 0.55,
                height * 0.35,
                Math.max(width, height)
            );
            gradient.addColorStop(0, "rgba(59, 130, 246, 0.06)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.00)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // **Draw loading spinner if loading**
            if (loading) {
                const spinnerRadius = 20;
                const now = Date.now() / 500; // speed
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.rotate(now % (2 * Math.PI));
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#3B82F6"; // blue
                ctx.beginPath();
                ctx.arc(0, 0, spinnerRadius, 0, Math.PI * 1.5);
                ctx.stroke();
                ctx.restore();

                // Text
                ctx.font = "16px sans-serif";
                ctx.fillStyle = "#1E293B"; // slate-800
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Loading session", width / 2, height / 2 - 45);
            }
        };

        draw();
        let raf = 0;
        const onResize = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(draw);
        };

        window.addEventListener("resize", onResize);
        const interval = setInterval(() => requestAnimationFrame(draw), 16); // ~60fps for spinner
        return () => {
            clearInterval(interval);
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [loading]);
}