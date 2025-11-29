import Vector from "./Vector";

class Point {
    constructor() {
        this.position = new Vector(0, 0);
        this.velocity = new Vector(0, 0);
        this.opacity = 0;
    }
    setPosition(position) {
        this.position = position;
    }
    setVelocity(velocity) {
        this.velocity = velocity;
    }
    getX() {
        return this.position.x;
    }
    getY() {
        return this.position.y;
    }
}

export default Point;