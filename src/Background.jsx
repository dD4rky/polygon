import { useEffect, useRef, useState } from "react";

import Point from "./Point";
import Vector from "./Vector";
import Delaunator from "delaunator";

import "./Background.css";

function AABB(position, box_size) {
    return (
        (position.x >= -100) &
        (position.x <= box_size.x + 100) &
        ((position.y >= -100) & (position.y <= box_size.y + 100))
    );
}

function Background() {
    // properties
    const [FPS, setFPS] = useState(60.0);
    const FPSRef = useRef(FPS);

    const [color, setColor] = useState("#ffffff");
    const colorRef = useRef(color);

    const [bgColor, setBgColor] = useState("#000000");

    let lastTime = 0;

    // canvas
    const canvasRef = useRef(null);

    // animation parameters
    const points = useRef([]);
    const edgesSet = useRef(new Set());

    const mousePosition = useRef(new Vector(-1000, -1000));
    const windowSize = useRef(new Vector(window.innerWidth, window.innerHeight));

    // misc
    let frameCount = 0;
    const animationId = useRef(null);

    // animation properties
    let allPointsCount = Math.min(256, (windowSize.current.x * windowSize.current.y) / 5e3);
    const opacityFactor = Math.min(windowSize.current.x, windowSize.current.y) / 10;
    const mouseRadius = Math.min(windowSize.current.x, windowSize.current.y) / 10;

    // properties update
    useEffect(() => {
        colorRef.current = color;
    }, [color]);
    useEffect(() => {
        FPSRef.current = FPS;
    }, [FPS]);

    function handleMouseMove(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        mousePosition.current.x = event.clientX - rect.left;
        mousePosition.current.y = event.clientY - rect.top;
    }

    function createPoint(point = null) {
        if (point == null) {
            point = new Point();
            points.current.push(point);
        }
        const position = new Vector(
            Math.random() * (windowSize.current.x + 200) - 100,
            Math.random() * (windowSize.current.y + 200) - 100
        );
        const velocity = new Vector(
            (Math.random() * windowSize.current.x - windowSize.current.x / 2) / 500,
            (Math.random() * windowSize.current.y - windowSize.current.y / 2) / 500
        );
        point.setPosition(position);
        point.setVelocity(velocity);
    }

    function drawLine(context, p1, p2, color) {
        context.lineWidth = 2;

        const linearGradient = context.createLinearGradient(
            p1.position.x,
            p1.position.y,
            p2.position.x,
            p2.position.y
        );
        const alphaP1 = Math.round(Math.min(1, p1.opacity) * 255).toString(16);
        const alphaP2 = Math.round(Math.min(1, p2.opacity) * 255).toString(16);

        const paddedAlphaP1 = alphaP1.length === 1 ? "0" + alphaP1 : alphaP1;
        const paddedAlphaP2 = alphaP2.length === 1 ? "0" + alphaP2 : alphaP2;

        linearGradient.addColorStop(0, color + paddedAlphaP1);
        linearGradient.addColorStop(1, color + paddedAlphaP2);

        context.strokeStyle = linearGradient;
        context.beginPath();
        context.moveTo(p1.position.x, p1.position.y);
        context.lineTo(p2.position.x, p2.position.y);
        context.stroke();
    }

    function render(color) {
        // context init
        const context = canvasRef.current.getContext("2d");
        if (!context) return;

        // clear buffer
        context.clearRect(0, 0, windowSize.current.x, windowSize.current.y);

        // draw points
        points.current.forEach((point) => {
            const alphaHex = Math.round(Math.min(1, point.opacity) * 255).toString(16);
            const paddedAlphaHex = alphaHex.length === 1 ? "0" + alphaHex : alphaHex;
            context.fillStyle = color + paddedAlphaHex;

            context.beginPath();
            context.arc(point.position.x, point.position.y, 2, 0, Math.PI * 2, false);
            context.fill();
        });

        // draw lines
        edgesSet.current.forEach((edge) => {
            const [a, b] = edge.split(",").map(Number);
            drawLine(context, points.current[a], points.current[b], color);
        });
    }

    function update(time = 0) {
        // framerate
        animationId.current = requestAnimationFrame((time) => update(time));
        const deltaTime = time - lastTime;
        if (deltaTime < 1000 / FPSRef.current) return;
        lastTime = time;

        frameCount += 1;

        // create new points
        while (allPointsCount > points.current.length) {
            createPoint();
        }

        // delete points out box
        let pointsDeleted = false;
        points.current.forEach((point) => {
            if (!AABB(point.position, windowSize.current)) {
                pointsDeleted = true;

                createPoint(point);
            }
        });
        // update points properties
        points.current.forEach((point) => {
            // update points velocity
            const dx = point.position.x - mousePosition.current.x;
            const dy = point.position.y - mousePosition.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= mouseRadius) {
                const normX = dx / distance;
                const normY = dy / distance;
                point.velocity.x += normX;
                point.velocity.y += normY;
            }
            // update points position
            point.position.x += point.velocity.x * 60 / FPSRef.current;
            point.position.y += point.velocity.y * 60 / FPSRef.current;
        });

        // update point opacity
        const radiusSq = opacityFactor * opacityFactor;

        points.current.forEach((point) => {
            let pointsCount = 0;
            points.current.forEach((point1) => {
                const dx = point.position.x - point1.position.x;
                const dy = point.position.y - point1.position.y;
                if (dx * dx + dy * dy < radiusSq) pointsCount++;
            });
            point.opacity =
                Math.pow(pointsCount, 2) / Math.pow(2, Math.ceil(Math.log2(allPointsCount)) - 2);
        });

        if (frameCount % 8 == 0 || pointsDeleted) {
            // generate triangles
            const delaunay = Delaunator.from(
                points.current,
                (point) => point.position.x,
                (point) => point.position.y
            );
            const triangles = delaunay.triangles;

            // get lines from triangles
            edgesSet.current.clear();

            for (let i = 0; i < triangles.length; i += 3) {
                const tri = [triangles[i], triangles[i + 1], triangles[i + 2]];

                const edgePairs = [
                    [tri[0], tri[1]],
                    [tri[1], tri[2]],
                    [tri[0], tri[2]],
                ];

                edgePairs.forEach(([a, b]) => {
                    const edge = a < b ? `${a},${b}` : `${b},${a}`;
                    edgesSet.current.add(edge);
                });
            }
        }
        render(colorRef.current);
    }

    useEffect(() => {
        const handleResize = () => {
            const newSize = new Vector(window.innerWidth, window.innerHeight);
            if (newSize.x === windowSize.x && newSize.y === windowSize.y) return;

            // scale points
            const aspectX = newSize.x / windowSize.x;
            const aspectY = newSize.y / windowSize.y;
            points.current.forEach((point) => {
                point.position.x *= aspectX;
                point.position.y *= aspectY;
                point.velocity.x *= aspectX;
                point.velocity.y *= aspectY;
            });

            // resize canvas
            const ctx = canvasRef.current.getContext("2d");
            ctx.canvas.width = newSize.x;
            ctx.canvas.height = newSize.y;

            allPointsCount = Math.min(256, (windowSize.current.x * windowSize.current.y) / 5e3);

            windowSize.current = newSize;
            requestAnimationFrame((time) => update(time));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        requestAnimationFrame((time) => update(time));
    }, []);

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(rgb) {
        return "#" + rgb.map(componentToHex).join("");
    }

    useEffect(() => {
        window.wallpaperPropertyListener = {
            applyUserProperties: function (properties) {
                if (properties.color) {
                    let customColor = properties.color.value.split(" ");
                    customColor = customColor.map(function (c) {
                        return Math.ceil(c * 255);
                    });

                    setColor(rgbToHex(customColor));
                }
                if (properties.background_color) {
                    let customColor = properties.background_color.value.split(" ");
                    customColor = customColor.map(function (c) {
                        return Math.ceil(c * 255);
                    });

                    setBgColor(rgbToHex(customColor));
                }
                if (properties.fps) {
                    setFPS(properties.fps);
                }
            },
        };
    });

    return (
        <>
            <canvas
                ref={canvasRef}
                style={{ backgroundColor: bgColor }}
                className="background"
                width={window.innerWidth}
                height={window.innerHeight}
                onMouseMove={handleMouseMove}
            ></canvas>
        </>
    );
}

export default Background;
