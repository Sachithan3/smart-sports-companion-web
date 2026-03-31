import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export class TableTennisGame3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.score = 0;
        this.highScore = 0;
        this.lastHitTime = 0;
        this.hitCooldownMs = 80;

        this.playerTarget = new THREE.Vector3(0, 0, 1.65);
        this.playerVelocity = new THREE.Vector3();
        this.previousPlayerPos = new THREE.Vector3();
        this.handVisible = false;

        this.ball = {
            pos: new THREE.Vector3(0, 0.2, 0),
            vel: new THREE.Vector3(2.1, 0.45, 0.8),
            radius: 0.055
        };

        this.init3D();
        this.resetBall(1);
    }

    init3D() {
        const initialWidth = this.canvas.clientWidth || this.canvas.width || 640;
        const initialHeight = this.canvas.clientHeight || this.canvas.height || 400;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060a18);
        this.scene.fog = new THREE.Fog(0x060a18, 7, 15);

        this.camera = new THREE.PerspectiveCamera(
            52,
            initialWidth / initialHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 1.8, 4.4);
        this.camera.lookAt(0, 0.35, 0.5);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(initialWidth, initialHeight, false);
        this.renderer.setClearColor(0x060a18, 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const ambient = new THREE.AmbientLight(0x7f8fb3, 0.42);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(3.6, 5.5, 4.2);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 5;
        key.shadow.camera.bottom = -5;
        this.scene.add(key);

        this.tableWidth = 3.0;
        this.tableDepth = 1.8;
        this.tableHeight = 0;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 16),
            new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.94, metalness: 0.05 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const table = new THREE.Mesh(
            new THREE.BoxGeometry(this.tableWidth, 0.08, this.tableDepth),
            new THREE.MeshStandardMaterial({ color: 0x1d3f86, roughness: 0.5, metalness: 0.15 })
        );
        table.position.set(0, this.tableHeight - 0.04, 0);
        table.receiveShadow = true;
        table.castShadow = true;
        this.scene.add(table);

        const lineMat = new THREE.MeshStandardMaterial({ color: 0xe6eefc });
        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.082, this.tableDepth), lineMat);
        centerLine.position.set(0, this.tableHeight + 0.002, 0);
        this.scene.add(centerLine);

        const net = new THREE.Mesh(
            new THREE.BoxGeometry(this.tableWidth, 0.16, 0.02),
            new THREE.MeshStandardMaterial({ color: 0xe8edf7, roughness: 0.75 })
        );
        net.position.set(0, this.tableHeight + 0.1, 0);
        net.castShadow = true;
        this.scene.add(net);

        this.playerPaddle = this.createPaddle(0x45a0ff);
        this.playerPaddle.position.set(0, 0.3, 1.65);
        this.scene.add(this.playerPaddle);

        this.aiPaddle = this.createPaddle(0xff6f61);
        this.aiPaddle.position.set(0, 0.3, -1.65);
        this.scene.add(this.aiPaddle);

        const ballMat = new THREE.MeshStandardMaterial({
            color: 0xffd369,
            emissive: 0x5a3a00,
            emissiveIntensity: 0.2,
            roughness: 0.32,
            metalness: 0.15
        });
        this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(this.ball.radius, 24, 24), ballMat);
        this.ballMesh.castShadow = true;
        this.scene.add(this.ballMesh);
    }

    createPaddle(color) {
        const group = new THREE.Group();
        const face = new THREE.Mesh(
            new THREE.CylinderGeometry(0.23, 0.23, 0.028, 28),
            new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.12 })
        );
        face.rotation.x = Math.PI / 2;
        face.castShadow = true;
        group.add(face);

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12),
            new THREE.MeshStandardMaterial({ color: 0x2f2f36, roughness: 0.8 })
        );
        handle.position.set(0, -0.28, 0);
        handle.castShadow = true;
        group.add(handle);
        return group;
    }

    resetBall(direction = 1) {
        this.ball.pos.set(0, 0.35, 0);
        const launchYaw = (Math.random() - 0.5) * 0.4;
        this.ball.vel.set(
            Math.sin(launchYaw) * 2.1,
            (Math.random() - 0.45) * 0.8,
            1.8 * direction
        );
    }

    updatePlayerFromHand(landmarks, dtMs) {
        if (!landmarks || landmarks.length === 0) {
            this.handVisible = false;
            return;
        }

        const hand = landmarks[0];
        const tip = hand[8];
        const wrist = hand[0];
        const palm = hand[9];

        const x = THREE.MathUtils.clamp((0.5 - tip.x) * 2.2, -1.25, 1.25);
        const y = THREE.MathUtils.clamp(0.2 + (0.65 - ((tip.y * 0.7) + (wrist.y * 0.3))) * 1.8, 0.15, 1.05);
        const zRaw = THREE.MathUtils.clamp(1.82 + ((wrist.z ?? 0) - (palm.z ?? 0)) * 4.0, 1.35, 2.05);

        this.playerTarget.set(x, y, zRaw);
        const smoothing = Math.min(1, (dtMs / 16.67) * 0.36);
        this.playerPaddle.position.lerp(this.playerTarget, smoothing);

        this.playerVelocity.copy(this.playerPaddle.position).sub(this.previousPlayerPos).multiplyScalar(1000 / Math.max(1, dtMs));
        this.previousPlayerPos.copy(this.playerPaddle.position);
        this.handVisible = true;
    }

    updateAIPaddle(dt) {
        const targetX = THREE.MathUtils.clamp(this.ball.pos.x * 0.85, -1.2, 1.2);
        const targetY = THREE.MathUtils.clamp(this.ball.pos.y * 0.9 + 0.15, 0.1, 1.0);
        this.aiPaddle.position.x = THREE.MathUtils.lerp(this.aiPaddle.position.x, targetX, dt * 2.2);
        this.aiPaddle.position.y = THREE.MathUtils.lerp(this.aiPaddle.position.y, targetY, dt * 2.0);
    }

    handlePaddleCollision(paddle, isPlayer, nowMs) {
        if (nowMs - this.lastHitTime < this.hitCooldownMs) {
            return false;
        }

        const delta = this.ball.pos.clone().sub(paddle.position);
        const closeInZ = Math.abs(delta.z) < 0.19;
        const radial = Math.hypot(delta.x, delta.y);
        if (!closeInZ || radial > 0.27) {
            return false;
        }

        this.ball.vel.z *= -1;
        this.ball.vel.z += isPlayer ? -0.15 : 0.15;
        this.ball.vel.x += delta.x * 1.4;
        this.ball.vel.y += delta.y * 1.1;

        if (isPlayer) {
            this.ball.vel.x += this.playerVelocity.x * 0.0018;
            this.ball.vel.y += this.playerVelocity.y * 0.0018;
            this.ball.vel.z += this.playerVelocity.z * 0.0014;
            this.score += 1;
            this.highScore = Math.max(this.highScore, this.score);
        }

        const maxSpeed = 4.2;
        const speed = this.ball.vel.length();
        if (speed > maxSpeed) {
            this.ball.vel.multiplyScalar(maxSpeed / speed);
        }

        this.lastHitTime = nowMs;
        return true;
    }

    updateBall(dt, nowMs) {
        this.ball.vel.y -= 2.35 * dt;
        this.ball.pos.addScaledVector(this.ball.vel, dt);

        if (this.ball.pos.x < -this.tableWidth / 2 + this.ball.radius || this.ball.pos.x > this.tableWidth / 2 - this.ball.radius) {
            this.ball.pos.x = THREE.MathUtils.clamp(this.ball.pos.x, -this.tableWidth / 2 + this.ball.radius, this.tableWidth / 2 - this.ball.radius);
            this.ball.vel.x *= -0.88;
        }

        if (this.ball.pos.y < this.tableHeight + this.ball.radius) {
            this.ball.pos.y = this.tableHeight + this.ball.radius;
            this.ball.vel.y = Math.abs(this.ball.vel.y) * 0.82;
            this.ball.vel.x *= 0.98;
            this.ball.vel.z *= 0.98;
        }

        this.handlePaddleCollision(this.playerPaddle, true, nowMs);
        this.handlePaddleCollision(this.aiPaddle, false, nowMs);

        if (this.ball.pos.z > this.tableDepth / 2 + 0.55) {
            this.score = 0;
            this.resetBall(-1);
        }

        if (this.ball.pos.z < -this.tableDepth / 2 - 0.55) {
            this.resetBall(1);
        }

        this.ballMesh.position.copy(this.ball.pos);
    }

    update(landmarks, dtMs, nowMs) {
        const dt = Math.min(0.04, dtMs / 1000);
        this.updatePlayerFromHand(landmarks, dtMs);
        this.updateAIPaddle(dt);
        this.updateBall(dt, nowMs);
    }

    draw() {
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
