import { useEffect, useRef, useState } from "react";
import Delaunator from "delaunator";
import "./Background.css";

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(vector) {
        return new Vector(this.x + vector.x, this.y + vector.y);
    }
    substract(vector) {
        return new Vector(this.x - vector.x, this.y - vector.y);
    }
    multiply(scalar) {
        return new Vector(this.x * scalar, this.y * scalar);
    }
    divide(scalar) {
        return new Vector(this.x / scalar, this.y / scalar);
    }
    length() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
}

class Point {
    constructor(position, velocity) {
        this.position = position;
        this.velocity = velocity;
        this.opacity = 0;
    }
    getX() {
        return this.position.x;
    }
    getY() {
        return this.position.y;
    }
}

function Background() {
    let lastTime = 0;
    const FPS = useRef(60);

    const canvasRef = useRef(null);
    const points = useRef([]);
    const edgesSet = useRef(new Set());

    const mousePosition = useRef(new Vector(-1000, -1000));
    const windowSize = useRef(
        new Vector(window.innerWidth, window.innerHeight)
    );
    const animationId = useRef(null);

    // animation properties
    let allPointsCount = Math.min(
        256,
        (windowSize.current.x * windowSize.current.y) / 5e3
    );
    const pointColorFactorRadius =
        Math.min(windowSize.current.x, windowSize.current.y) / 10;
    const mouseRadius =
        Math.min(windowSize.current.x, windowSize.current.y) / 10;

    const [color, setColor] = useState("#ffffff");
    const [bgColor, setBgColor] = useState("#000000");

    const colorRef = useRef(color);

    useEffect(() => {
        colorRef.current = color;
    }, [color]);

    function handleMouseMove(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        mousePosition.current.x = event.clientX - rect.left;
        mousePosition.current.y = event.clientY - rect.top;
    }

    function createPoint() {
        const position = new Vector(
            Math.random() * (windowSize.current.x + 200) - 100,
            Math.random() * (windowSize.current.y + 200) - 100
        );
        const velocity = new Vector(
            (Math.random() * windowSize.current.x - windowSize.current.x / 2) /
                500,
            (Math.random() * windowSize.current.y - windowSize.current.y / 2) /
                500
        );
        points.current.push(new Point(position, velocity));
    }
    function drawLine(context, p1, p2, color) {
        context.lineWidth = 2;

        const start_x = p1.position.x;
        const start_y = p1.position.y;
        const end_x = p2.position.x;
        const end_y = p2.position.y;

        const linearGradient = context.createLinearGradient(
            start_x,
            start_y,
            end_x,
            end_y
        );
        const alphaP1 = Math.round(Math.min(1, p1.opacity) * 255).toString(16);
        const alphaP2 = Math.round(Math.min(1, p2.opacity) * 255).toString(16);

        const paddedAlphaP1 = alphaP1.length === 1 ? "0" + alphaP1 : alphaP1;
        const paddedAlphaP2 = alphaP2.length === 1 ? "0" + alphaP2 : alphaP2;

        linearGradient.addColorStop(0, color + paddedAlphaP1);
        linearGradient.addColorStop(1, color + paddedAlphaP2);

        context.strokeStyle = linearGradient;
        context.beginPath();
        context.moveTo(start_x, start_y);
        context.lineTo(end_x, end_y);
        context.stroke();
    }

    function render(color) {
        // canvas init
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // clear buffer
        context.clearRect(0, 0, windowSize.current.x, windowSize.current.y);

        // draw points
        points.current.forEach((point) => {
            const alphaHex = Math.round(
                Math.min(1, point.opacity) * 255
            ).toString(16);
            const paddedAlphaHex =
                alphaHex.length === 1 ? "0" + alphaHex : alphaHex;
            context.fillStyle = color + paddedAlphaHex;

            context.beginPath();
            context.arc(
                point.position.x,
                point.position.y,
                2,
                0,
                Math.PI * 2,
                true
            );
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
        if (deltaTime < 1000 / FPS.current) {
            return;
        }
        lastTime = time;

        // create new points
        while (allPointsCount > points.current.length) {
            createPoint();
        }

        // delete points out box
        points.current.forEach((point) => {
            if (
                !(
                    (point.position.x >= -100) &
                    (point.position.x <= windowSize.current.x + 100) &
                    ((point.position.y >= -100) &
                        (point.position.y <= windowSize.current.y + 100))
                )
            ) {
                point.position = new Vector(
                    Math.random() * (windowSize.current.x + 200) - 100,
                    Math.random() * (windowSize.current.y + 200) - 100
                );
                point.velocity = new Vector(
                    (Math.random() * windowSize.current.x -
                        windowSize.current.x / 2) /
                        500,
                    (Math.random() * windowSize.current.y -
                        windowSize.current.y / 2) /
                        500
                );
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
            point.position.x += point.velocity.x;
            point.position.y += point.velocity.y;
        });

        // update point opacity
        const radiusSq = pointColorFactorRadius * pointColorFactorRadius;

        points.current.forEach((point) => {
            let pointsCount = 0;
            points.current.forEach((point1) => {
                const dx = point.position.x - point1.position.x;
                const dy = point.position.y - point1.position.y;
                if (dx * dx + dy * dy < radiusSq) pointsCount++;
            });
            point.opacity =
                Math.pow(pointsCount, 2) /
                Math.pow(2, Math.ceil(Math.log2(allPointsCount)) - 2);
        });

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
                // Упорядочиваем индексы, чтобы (a,b) и (b,a) считались одинаковыми
                const edge = a < b ? `${a},${b}` : `${b},${a}`;
                edgesSet.current.add(edge);
            });
        }
        render(colorRef.current);
    }

    useEffect(() => {
        const handleResize = () => {
            const newSize = new Vector(window.innerWidth, window.innerHeight);
            if (newSize.x === windowSize.x && newSize.y === windowSize.y)
                return;

            // масштабируем точки
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

            allPointsCount =
                (windowSize.current.x * windowSize.current.y) / 5e3;

            windowSize.current = newSize;
            requestAnimationFrame((time) => update(time));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        // init();
        requestAnimationFrame((time) => update(time));
    }, []);

    useEffect(() => {
        window.wallpaperPropertyListener = {
            applyUserProperties: function (properties) {
                function componentToHex(c) {
                    var hex = c.toString(16);
                    return hex.length == 1 ? "0" + hex : hex;
                }

                function rgbToHex(rgb) {
                    return "#" + rgb.map(componentToHex).join("");
                }

                if (properties.color) {
                    let customColor = properties.color.value.split(" ");
                    customColor = customColor.map(function (c) {
                        return Math.ceil(c * 255);
                    });

                    setColor(rgbToHex(customColor));
                }
                if (properties.background_color) {
                    let customColor =
                        properties.background_color.value.split(" ");
                    customColor = customColor.map(function (c) {
                        return Math.ceil(c * 255);
                    });

                    setBgColor(rgbToHex(customColor));
                }
                if (properties.fps) {
                    FPS.current = properties.fps;
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
