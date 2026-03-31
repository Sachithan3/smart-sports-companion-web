import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export class TableTennisGame3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.score = 0;
        this.highScore = 0;
        this.lastHitTime = 0;
        this.hitCooldownMs = 80;
        this.rallyResetDelayMs = 900;
        this.pendingServeAt = 0;
        this.nextServeDirection = 1;
        this.isRallyLive = true;
        this.ballTravelSpeed = 1.45;
        this.bounceZBySide = { player: 0.62, ai: -0.62 };
        this.ballY = 0.12;
        this.playerPaddleZ = 0.78;
        this.aiPaddleZ = -0.78;
        this.playerHitAssistX = 0.48;
        this.paddlePlaneCaptureZ = 0.35;
        this.maxBallSpeed = 2.1;
        this.ballSpeedGainPerHit = 0.02;
        this.missMargin = 0.22;
        this.phase = "to_player_bounce";

        this.playerTarget = new THREE.Vector3(0, 0, 1.65);
        this.playerVelocity = new THREE.Vector3();
        this.previousPlayerPos = new THREE.Vector3();
        this.handVisible = false;
        this.previousBallPos = new THREE.Vector3();

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
        this.playerPaddle.position.set(0, 0.3, this.playerPaddleZ);
        this.scene.add(this.playerPaddle);

        this.aiPaddle = this.createPaddle(0xff6f61);
        this.aiPaddle.position.set(0, 0.3, this.aiPaddleZ);
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
        this.ball.pos.set(0, this.ballY, 0);
        const launchYaw = (Math.random() - 0.5) * 0.4;
        this.ball.vel.set(Math.sin(launchYaw) * (this.ballTravelSpeed * 0.25), 0, this.ballTravelSpeed * direction);
        this.isRallyLive = true;
        this.pendingServeAt = 0;
        this.nextServeDirection = direction;
        this.previousBallPos.copy(this.ball.pos);
        this.phase = direction > 0 ? "to_player_bounce" : "to_ai_bounce";
    }

    handleRallyMiss(direction, nowMs) {
        if (!this.isRallyLive) {
            return;
        }
        this.isRallyLive = false;
        this.score = 0;
        this.pendingServeAt = nowMs + this.rallyResetDelayMs;
        this.nextServeDirection = direction;
    }

    setDirectionTowardPlayer() {
        this.ball.vel.z = Math.abs(this.ballTravelSpeed);
    }

    setDirectionTowardAi() {
        this.ball.vel.z = -Math.abs(this.ballTravelSpeed);
    }

    updatePlayerFromHand(landmarksInput, dtMs) {
        const landmarks = Array.isArray(landmarksInput) ? landmarksInput : landmarksInput?.hands;
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
        const zRaw = THREE.MathUtils.clamp(this.playerPaddleZ + ((wrist.z ?? 0) - (palm.z ?? 0)) * 0.12, this.playerPaddleZ - 0.04, this.playerPaddleZ + 0.06);

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

    handlePlayerPaddleCollision(nowMs, prevBallPos) {
        if (nowMs - this.lastHitTime < this.hitCooldownMs) {
            return false;
        }
        if (this.phase !== "to_player_paddle") {
            return false;
        }
        if (this.ball.vel.z <= 0) {
            return false;
        }

        const paddle = this.playerPaddle;
        const currentZDiff = this.ball.pos.z - this.playerPaddleZ;
        const prevZDiff = prevBallPos.z - this.playerPaddleZ;
        const crossedPaddlePlane = (prevZDiff <= 0 && currentZDiff >= 0) || (prevZDiff >= 0 && currentZDiff <= 0);
        const inRangeNow = Math.abs(currentZDiff) < this.paddlePlaneCaptureZ;
        if (!crossedPaddlePlane && !inRangeNow) {
            return false;
        }

        const denom = prevZDiff - currentZDiff;
        const t = Math.abs(denom) < 1e-6 ? 1 : THREE.MathUtils.clamp(prevZDiff / denom, 0, 1);
        const hitX = THREE.MathUtils.lerp(prevBallPos.x, this.ball.pos.x, t);
        const dx = hitX - paddle.position.x;
        if (Math.abs(dx) > this.playerHitAssistX) {
            return false;
        }

        this.ball.pos.x = THREE.MathUtils.clamp(hitX, -this.tableWidth / 2 + this.ball.radius, this.tableWidth / 2 - this.ball.radius);
        this.ball.pos.y = this.ballY;
        this.ball.pos.z = this.playerPaddleZ - (this.ball.radius + 0.02);
        this.ballTravelSpeed = Math.min(this.maxBallSpeed, this.ballTravelSpeed + this.ballSpeedGainPerHit);
        this.setDirectionTowardAi();
        this.ball.vel.x = THREE.MathUtils.clamp(dx * 1.0 + this.playerVelocity.x * 0.0008, -0.85, 0.85);
        this.phase = "to_ai_bounce";

        this.score += 1;
        this.highScore = Math.max(this.highScore, this.score);
        this.lastHitTime = nowMs;
        return true;
    }

    opponentReturn() {
        this.ball.pos.z = this.aiPaddleZ + this.ball.radius + 0.02;
        this.setDirectionTowardPlayer();
        const tableHalfW = this.tableWidth / 2 - this.ball.radius;
        const desiredBounceX = THREE.MathUtils.clamp(this.playerPaddle.position.x + (Math.random() - 0.5) * 0.28, -tableHalfW, tableHalfW);
        const dzToBounce = Math.max(0.001, this.bounceZBySide.player - this.ball.pos.z);
        const travelTime = dzToBounce / Math.abs(this.ball.vel.z);
        const requiredVx = (desiredBounceX - this.ball.pos.x) / travelTime;
        this.ball.vel.x = THREE.MathUtils.clamp(requiredVx, -0.55, 0.55);
        this.phase = "to_player_bounce";
    }

    updateBall(dt, nowMs) {
        this.previousBallPos.copy(this.ball.pos);
        this.ball.vel.y = 0;
        this.ball.pos.addScaledVector(this.ball.vel, dt);
        this.ball.pos.y = this.ballY;

        const tableHalfW = this.tableWidth / 2 - this.ball.radius;
        if (this.ball.pos.x < -tableHalfW || this.ball.pos.x > tableHalfW) {
            this.ball.pos.x = THREE.MathUtils.clamp(this.ball.pos.x, -tableHalfW, tableHalfW);
            this.ball.vel.x *= -1;
        }

        if (!this.isRallyLive) {
            if (this.pendingServeAt > 0 && nowMs >= this.pendingServeAt) {
                this.resetBall(this.nextServeDirection ?? 1);
            }
            this.ballMesh.position.copy(this.ball.pos);
            return;
        }

        if (this.phase === "to_ai_bounce" && this.ball.pos.z <= this.bounceZBySide.ai) {
            this.ball.pos.z = this.bounceZBySide.ai;
            this.phase = "to_ai_paddle";
        } else if (this.phase === "to_ai_paddle" && this.ball.pos.z <= this.aiPaddleZ + this.ball.radius + 0.02) {
            this.opponentReturn();
        } else if (this.phase === "to_player_bounce" && this.ball.pos.z >= this.bounceZBySide.player) {
            this.ball.pos.z = this.bounceZBySide.player;
            this.phase = "to_player_paddle";
        }

        this.handlePlayerPaddleCollision(nowMs, this.previousBallPos);

        if (this.phase === "to_player_paddle" && this.ball.pos.z > this.playerPaddleZ + this.missMargin) {
            this.handleRallyMiss(-1, nowMs);
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
