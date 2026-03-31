import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export class BadmintonGame {
    constructor(canvas) {
        this.canvas = canvas;

        this.score = 0;
        this.highScore = 0;
        this.lastHitTime = 0;
        this.cooldownMs = 120;

        this.racketVelocity = new THREE.Vector3();
        this.prevRacketPosition = new THREE.Vector3();
        this.racketTarget = new THREE.Vector3(0, 0.95, 1.85);
        this.handVisible = false;

        this.shuttle = {
            pos: new THREE.Vector3(0, 1.6, 0.4),
            vel: new THREE.Vector3(0.3, -0.45, -0.6),
            radius: 0.06
        };

        this.gravity = 5.8;
        this.drag = 0.62;
        this.sideLimit = 2.25;
        this.backLimit = 3.25;

        this.init3D();
        this.resetBirdie();
    }

    init3D() {
        const initialWidth = this.canvas.clientWidth || this.canvas.width || 640;
        const initialHeight = this.canvas.clientHeight || this.canvas.height || 400;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x07131d);
        this.scene.fog = new THREE.Fog(0x07131d, 8, 22);

        this.camera = new THREE.PerspectiveCamera(
            56,
            initialWidth / initialHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 1.9, 5.8);
        this.camera.lookAt(0, 1.0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(initialWidth, initialHeight, false);
        this.renderer.setClearColor(0x07131d, 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene.add(new THREE.AmbientLight(0x99accf, 0.45));

        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(3.4, 6, 3.2);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -6;
        key.shadow.camera.right = 6;
        key.shadow.camera.top = 6;
        key.shadow.camera.bottom = -6;
        this.scene.add(key);

        const fill = new THREE.PointLight(0x5fb2ff, 0.45, 16);
        fill.position.set(-2.5, 2.4, 2.3);
        this.scene.add(fill);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(24, 24),
            new THREE.MeshStandardMaterial({ color: 0x173a28, roughness: 0.93, metalness: 0.04 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const courtLineMat = new THREE.MeshStandardMaterial({ color: 0xf4f6fa });
        const courtOutline = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 8.5), new THREE.MeshStandardMaterial({ color: 0x1f6d40 }));
        courtOutline.rotation.x = -Math.PI / 2;
        courtOutline.position.y = 0.001;
        this.scene.add(courtOutline);

        const sidelineL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 8.5), courtLineMat);
        sidelineL.position.set(-2.4, 0.01, 0);
        const sidelineR = sidelineL.clone();
        sidelineR.position.x = 2.4;
        const baselineNear = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.01, 0.05), courtLineMat);
        baselineNear.position.set(0, 0.01, 4.25);
        const baselineFar = baselineNear.clone();
        baselineFar.position.z = -4.25;
        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 8.5), courtLineMat);
        centerLine.position.set(0, 0.01, 0);
        this.scene.add(sidelineL, sidelineR, baselineNear, baselineFar, centerLine);

        const net = new THREE.Mesh(
            new THREE.BoxGeometry(4.9, 0.85, 0.03),
            new THREE.MeshStandardMaterial({ color: 0xe7ecf7, roughness: 0.78 })
        );
        net.position.set(0, 0.45, 0);
        net.castShadow = true;
        this.scene.add(net);

        this.racket = this.createRacket();
        this.racket.position.set(0, 1, 1.8);
        this.scene.add(this.racket);

        this.shuttleGroup = this.createShuttle();
        this.shuttleGroup.castShadow = true;
        this.scene.add(this.shuttleGroup);
    }

    createRacket() {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.2, 0.015, 12, 36),
            new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.38 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        group.add(ring);

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12),
            new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.8 })
        );
        handle.position.set(0, -0.25, 0);
        handle.castShadow = true;
        group.add(handle);
        return group;
    }

    createShuttle() {
        const group = new THREE.Group();
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.08, 0.16, 18),
            new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.74 })
        );
        cone.rotation.x = Math.PI;
        cone.position.y = 0.03;
        group.add(cone);

        const cork = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 18, 18),
            new THREE.MeshStandardMaterial({ color: 0xe0b85f, roughness: 0.6 })
        );
        cork.position.y = -0.07;
        group.add(cork);
        return group;
    }

    resetBirdie() {
        this.shuttle.pos.set((Math.random() - 0.5) * 1.4, 1.8, -1.4 + Math.random() * 1.0);
        this.shuttle.vel.set((Math.random() - 0.5) * 0.9, -0.55, 1.4 + Math.random() * 0.6);
    }

    updateRacketFromHand(landmarksInput, dtMs) {
        const landmarks = Array.isArray(landmarksInput) ? landmarksInput : landmarksInput?.hands;
        if (!landmarks || landmarks.length === 0) {
            this.handVisible = false;
            return;
        }

        const hand = landmarks[0];
        const tip = hand[8];
        const wrist = hand[0];
        const palm = hand[9];

        const x = THREE.MathUtils.clamp((0.5 - tip.x) * 4.2, -2.1, 2.1);
        const y = THREE.MathUtils.clamp(0.25 + (0.75 - ((tip.y * 0.7) + (wrist.y * 0.3))) * 2.6, 0.35, 2.3);
        const z = THREE.MathUtils.clamp(2.1 + ((wrist.z ?? 0) - (palm.z ?? 0)) * 6.8, 1.1, 2.9);

        this.racketTarget.set(x, y, z);
        const alpha = Math.min(1, (dtMs / 16.67) * 0.34);
        this.racket.position.lerp(this.racketTarget, alpha);

        this.racketVelocity.copy(this.racket.position).sub(this.prevRacketPosition).multiplyScalar(1000 / Math.max(1, dtMs));
        this.prevRacketPosition.copy(this.racket.position);

        const velLen = this.racketVelocity.length();
        if (velLen > 0.001) {
            const tilt = THREE.MathUtils.clamp(this.racketVelocity.y / 1200, -0.35, 0.35);
            const yaw = THREE.MathUtils.clamp(this.racketVelocity.x / 1200, -0.35, 0.35);
            this.racket.rotation.set(Math.PI / 2 + tilt, yaw, 0);
        }
        this.handVisible = true;
    }

    checkHit(nowMs) {
        if (nowMs - this.lastHitTime < this.cooldownMs) return;

        const delta = this.shuttle.pos.clone().sub(this.racket.position);
        const dist = delta.length();
        const racketSpeed = this.racketVelocity.length();

        if (dist > 0.3) return;

        const intentionalSwing = racketSpeed > 430 || this.racketVelocity.y > 250;
        if (!intentionalSwing && this.shuttle.vel.y <= 0) return;

        this.score += 1;
        this.highScore = Math.max(this.highScore, this.score);
        this.lastHitTime = nowMs;

        const outward = delta.normalize();
        const base = 2.1;
        this.shuttle.vel.x = this.racketVelocity.x * 0.0026 + outward.x * base * 0.7;
        this.shuttle.vel.y = 1.9 + this.racketVelocity.y * 0.0028 + Math.max(0, outward.y) * 0.8;
        this.shuttle.vel.z = -1.8 + this.racketVelocity.z * 0.0024 - outward.z * 0.8;

        const max = 5.4;
        const speed = this.shuttle.vel.length();
        if (speed > max) {
            this.shuttle.vel.multiplyScalar(max / speed);
        }
    }

    updatePhysics(dt) {
        const speed = this.shuttle.vel.length();
        if (speed > 0) {
            const dragForce = this.drag * speed * speed;
            const dragVec = this.shuttle.vel.clone().normalize().multiplyScalar(-dragForce * dt * 0.08);
            this.shuttle.vel.add(dragVec);
        }

        this.shuttle.vel.y -= this.gravity * dt;
        this.shuttle.pos.addScaledVector(this.shuttle.vel, dt);

        if (this.shuttle.pos.x < -this.sideLimit || this.shuttle.pos.x > this.sideLimit) {
            this.shuttle.pos.x = THREE.MathUtils.clamp(this.shuttle.pos.x, -this.sideLimit, this.sideLimit);
            this.shuttle.vel.x *= -0.58;
        }

        if (this.shuttle.pos.z < -this.backLimit || this.shuttle.pos.z > this.backLimit) {
            this.shuttle.pos.z = THREE.MathUtils.clamp(this.shuttle.pos.z, -this.backLimit, this.backLimit);
            this.shuttle.vel.z *= -0.5;
        }

        if (this.shuttle.pos.y < this.shuttle.radius) {
            this.shuttle.pos.y = this.shuttle.radius;
            this.score = 0;
            this.resetBirdie();
        }

        this.shuttleGroup.position.copy(this.shuttle.pos);
        this.shuttleGroup.lookAt(this.shuttle.pos.clone().add(this.shuttle.vel));
    }

    update(landmarks, dtMs, nowMs) {
        const dt = Math.min(0.04, dtMs / 1000);
        this.updateRacketFromHand(landmarks, dtMs);
        this.checkHit(nowMs);
        this.updatePhysics(dt);
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
