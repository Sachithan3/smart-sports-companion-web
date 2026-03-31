import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export class BoxingGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.score = 0;
        this.highScore = 0;
        this.missCount = 0;

        this.targetRadius = 0.3;
        this.targetBounds = {
            minX: -1.2,
            maxX: 1.2,
            minY: 0.75,
            maxY: 1.65
        };
        this.activeTarget = { x: 0, y: 1.2 };
        this.targetActive = false;
        this.targetSpawnAt = 0;
        this.targetExpiresAt = 0;
        this.targetHitFlashUntil = 0;
        this.targetLifetimeMinMs = 1000;
        this.targetLifetimeMaxMs = 2000;
        this.respawnDelayMs = 200;
        this.maxMisses = 3;
        this.handInsideTarget = false;
        this.smoothedHand = null;
        this.smoothingAlpha = 0.3;
        this.microMovementThreshold = 0.003;
        this.hitScale = 1.08;

        this.init3D();
        this.resetRound();
    }

    init3D() {
        const w = this.canvas.clientWidth || this.canvas.width || 640;
        const h = this.canvas.clientHeight || this.canvas.height || 400;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x090f1b);
        this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 100);
        this.camera.position.set(0, 1.7, 4.6);
        this.camera.lookAt(0, 1.1, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h, false);
        this.renderer.setClearColor(0x090f1b, 1);

        this.scene.add(new THREE.AmbientLight(0x90a8d6, 0.45));
        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(3.5, 5.5, 3.2);
        this.scene.add(key);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0x20242f, roughness: 0.95 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);

        this.targetMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(this.targetRadius, this.targetRadius, 0.18, 42),
            new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.35, metalness: 0.08 })
        );
        this.targetMesh.rotation.x = Math.PI / 2;
        this.targetMesh.position.set(this.activeTarget.x, this.activeTarget.y, -0.55);
        this.targetMesh.visible = false;
        this.scene.add(this.targetMesh);

        this.handCursorMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 20, 20),
            new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x21466b, emissiveIntensity: 0.6, roughness: 0.35 })
        );
        this.handCursorMesh.position.set(0, 1.1, -0.4);
        this.handCursorMesh.visible = false;
        this.scene.add(this.handCursorMesh);
    }

    resetRound() {
        this.score = 0;
        this.missCount = 0;
        this.targetActive = false;
        this.targetSpawnAt = performance.now() + 250;
        this.targetExpiresAt = 0;
        this.targetHitFlashUntil = 0;
        this.targetMesh.visible = false;
        this.targetMesh.scale.set(1, 1, 1);
        this.handCursorMesh.visible = false;
        this.handInsideTarget = false;
        this.smoothedHand = null;
    }

    choosePunchHand(hands) {
        if (!hands || hands.length === 0) return null;
        if (hands.length === 1) return hands[0];
        return hands[0][9].x > hands[1][9].x ? hands[0] : hands[1];
    }

    randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    spawnTarget(nowMs) {
        this.activeTarget = {
            x: this.randomRange(this.targetBounds.minX, this.targetBounds.maxX),
            y: this.randomRange(this.targetBounds.minY, this.targetBounds.maxY)
        };
        this.targetMesh.position.set(this.activeTarget.x, this.activeTarget.y, -0.55);
        this.targetMesh.material.color.set(0xff5c5c);
        this.targetMesh.scale.set(1, 1, 1);
        this.targetMesh.visible = true;
        this.targetActive = true;
        this.handInsideTarget = false;
        this.targetHitFlashUntil = 0;
        const life = this.randomRange(this.targetLifetimeMinMs, this.targetLifetimeMaxMs);
        this.targetExpiresAt = nowMs + life;
    }

    registerHit(nowMs) {
        this.score += 1;
        this.highScore = Math.max(this.highScore, this.score);
        this.targetActive = false;
        this.targetHitFlashUntil = nowMs + 140;
        this.targetSpawnAt = nowMs + this.respawnDelayMs;
        this.targetMesh.material.color.set(0x48da89);
        this.targetMesh.scale.set(this.hitScale, this.hitScale, this.hitScale);
    }

    registerMiss(nowMs) {
        this.score -= 1;
        this.missCount += 1;
        this.targetActive = false;
        this.targetMesh.visible = false;
        this.targetMesh.scale.set(1, 1, 1);
        this.handInsideTarget = false;
        if (this.missCount >= this.maxMisses) {
            this.score = 0;
            this.missCount = 0;
            this.targetSpawnAt = nowMs + 350;
            return;
        }
        this.targetSpawnAt = nowMs + this.respawnDelayMs;
    }

    handToWorld(handPos) {
        return {
            x: THREE.MathUtils.clamp((handPos.x - 0.5) * 2.25, -1.4, 1.4),
            y: THREE.MathUtils.clamp(0.2 + (0.75 - handPos.y) * 2.2, 0.55, 1.75)
        };
    }

    updateFromHandTouch(tracking, nowMs) {
        const hands = tracking?.hands;
        const hand = this.choosePunchHand(hands);
        if (!hand) {
            this.handCursorMesh.visible = false;
            this.handInsideTarget = false;
            return;
        }

        const handPoint = hand[8] || hand[9] || hand[0];
        if (!handPoint) {
            this.handCursorMesh.visible = false;
            this.handInsideTarget = false;
            return;
        }
        const trackedPoint = { x: 1 - handPoint.x, y: handPoint.y };

        if (!this.smoothedHand) {
            this.smoothedHand = { x: trackedPoint.x, y: trackedPoint.y };
        } else {
            const dxRaw = trackedPoint.x - this.smoothedHand.x;
            const dyRaw = trackedPoint.y - this.smoothedHand.y;
            if (Math.abs(dxRaw) > this.microMovementThreshold || Math.abs(dyRaw) > this.microMovementThreshold) {
                this.smoothedHand.x = this.smoothedHand.x * (1 - this.smoothingAlpha) + trackedPoint.x * this.smoothingAlpha;
                this.smoothedHand.y = this.smoothedHand.y * (1 - this.smoothingAlpha) + trackedPoint.y * this.smoothingAlpha;
            }
        }

        const world = this.handToWorld(this.smoothedHand);
        this.handCursorMesh.position.set(world.x, world.y, -0.4);
        this.handCursorMesh.visible = true;
        if (!this.targetActive) {
            this.handInsideTarget = false;
            return;
        }
        const dx = world.x - this.activeTarget.x;
        const dy = world.y - this.activeTarget.y;
        const isInside = Math.hypot(dx, dy) <= this.targetRadius * 1.25;
        if (isInside && !this.handInsideTarget) this.registerHit(nowMs);
        this.handInsideTarget = isInside;
    }

    updateTargetLifecycle(nowMs) {
        if (this.targetActive && nowMs >= this.targetExpiresAt) {
            this.registerMiss(nowMs);
        }

        if (!this.targetActive && this.targetHitFlashUntil > 0) {
            if (nowMs < this.targetHitFlashUntil) {
                const pulse = this.hitScale + Math.sin(nowMs * 0.04) * 0.04;
                this.targetMesh.scale.set(pulse, pulse, pulse);
            } else {
                this.targetHitFlashUntil = 0;
                this.targetMesh.visible = false;
                this.targetMesh.scale.set(1, 1, 1);
            }
        }

        if (!this.targetActive && this.targetHitFlashUntil === 0 && nowMs >= this.targetSpawnAt) {
            this.spawnTarget(nowMs);
        }

        if (this.targetActive) {
            this.targetMesh.material.color.set(0xff5c5c);
            this.targetMesh.scale.set(1, 1, 1);
            return;
        }
    }

    getOverlayTargets() {
        return {
            smoothedHand: this.smoothedHand ? { x: this.smoothedHand.x, y: this.smoothedHand.y } : null
        };
    }

    update(tracking, dtMs, nowMs) {
        this.updateTargetLifecycle(nowMs);
        this.updateFromHandTouch(tracking, nowMs);
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
        if (this.renderer) this.renderer.dispose();
    }
}
