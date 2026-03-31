import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

export class Badminton3D {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Game Constants - Badminton Scale
        this.COURT = { width: 6.1, length: 13.4, height: 0 };
        this.NET = { height: 1.55, thickness: 0.02 };
        this.SHUTTLE = { radius: 0.10, mass: 0.005 }; 
        this.RACKET = { radius: 0.30, thickness: 0.02, handleLength: 0.6 }; // Massively scaled up mesh and frame to virtually guarantee hit logic
        
        this.PHYSICS = {
            gravity: -8.0,      // Restored strong gravity for a true parabolic arc
            airResistance: 0.995,
            racketRestitution: 1.25
        };
        
        this.DIFFICULTY = {
            easy: { speed: 4.0, errorMargin: 0.3 },
            medium: { speed: 6.0, errorMargin: 0.15 },
            hard: { speed: 8.0, errorMargin: 0.05 }
        };

        // Game State
        this.gameState = 'waiting';
        this.scorePlayer = 0;
        this.scoreAI = 0;
        this.rallyCount = 0;
        this.difficulty = 'medium';
        this.shuttleVelocity = new THREE.Vector3();
        this.aiTarget = new THREE.Vector3();
        this.lastHitter = null;
        
        // Tracking state
        this.lastHitTime = 0;
        this.cooldownMs = 150;
        this.racketVelocity = new THREE.Vector3();
        this.prevRacketPosition = new THREE.Vector3(0, 2.0, 6.0);
        this.racketTarget = new THREE.Vector3(0, 2.0, 6.0);
        this.prevShuttlePosition = new THREE.Vector3();

        this.initScene();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); // Green court bg
        this.scene.fog = new THREE.Fog(0x27ae60, 8, 20);
        
        // Camera closer to ground, almost front view of net
        this.camera = new THREE.PerspectiveCamera(60, this.canvas.width / this.canvas.height, 0.1, 100);
        this.camera.position.set(0, 1.2, 7.5); // At baseline level
        this.camera.lookAt(0, 1.0, 0); // Looking straight at net
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 1024;
        mainLight.shadow.mapSize.height = 1024;
        this.scene.add(mainLight);
        
        this.createCourt();
        this.createNet();
        this.createShuttle();
        this.createRackets();
        
        this.clock = new THREE.Clock();
    }

    createCourt() {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(this.COURT.width + 4, this.COURT.length + 4);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e8449, roughness: 0.9, metalness: 0.0 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // Lines
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const addLine = (w, h, x, z) => {
            const line = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(x, 0.01, z);
            this.scene.add(line);
        };
        
        // Outer bounds
        addLine(this.COURT.width, 0.05, 0, this.COURT.length/2);
        addLine(this.COURT.width, 0.05, 0, -this.COURT.length/2);
        addLine(0.05, this.COURT.length, this.COURT.width/2, 0);
        addLine(0.05, this.COURT.length, -this.COURT.width/2, 0);
        // Center line
        addLine(0.05, this.COURT.length, 0, 0);
        // Serve lines
        addLine(this.COURT.width, 0.05, 0, 1.98);
        addLine(this.COURT.width, 0.05, 0, -1.98);
    }

    createNet() {
        // Posts
        const postGeo = new THREE.CylinderGeometry(0.02, 0.02, this.NET.height);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-this.COURT.width/2 - 0.1, this.NET.height/2, 0);
        this.scene.add(leftPost);
        
        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(this.COURT.width/2 + 0.1, this.NET.height/2, 0);
        this.scene.add(rightPost);
        
        // Net mesh
        const netGeo = new THREE.PlaneGeometry(this.COURT.width + 0.2, 0.7);
        const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.net = new THREE.Mesh(netGeo, netMat);
        this.net.position.set(0, this.NET.height - 0.35, 0);
        this.scene.add(this.net);
    }

    createShuttle() {
        this.shuttle = new THREE.Group();
        
        // Cork (Head)
        const corkGeo = new THREE.SphereGeometry(this.SHUTTLE.radius, 16, 16);
        const corkMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, roughness: 0.5 });
        const cork = new THREE.Mesh(corkGeo, corkMat);
        this.shuttle.add(cork);
        
        // Skirt (Feathers)
        const skirtGeo = new THREE.ConeGeometry(this.SHUTTLE.radius * 2, this.SHUTTLE.radius * 2.5, 12, 1, true);
        const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
        const skirt = new THREE.Mesh(skirtGeo, skirtMat);
        skirt.position.y = this.SHUTTLE.radius * 1.5;
        this.shuttle.add(skirt);
        
        this.scene.add(this.shuttle);
        this.resetShuttlePosition();
    }

    createRacketMesh(color) {
        const group = new THREE.Group();
        
        // Head Handle
        const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, this.RACKET.handleLength);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -this.RACKET.handleLength / 2 - this.RACKET.radius;
        group.add(handle);
        
        // Head Frame
        const frameGeo = new THREE.TorusGeometry(this.RACKET.radius, 0.01, 16, 32);
        const frameMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
        const racketFrame = new THREE.Mesh(frameGeo, frameMat);
        group.add(racketFrame);
        
        // Strings
        // Matched to frame's total radius + 0.01 so it reaches directly into the tube for a seamless visual size
        const stringGeo = new THREE.CylinderGeometry(this.RACKET.radius + 0.01, this.RACKET.radius + 0.01, 0.005, 32);
        const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }); // depthWrite: false stops the temporary disappearance bug caused by transparent Z-fighting against the net!
        const strings = new THREE.Mesh(stringGeo, stringMat);
        strings.rotation.x = Math.PI / 2;
        group.add(strings);
        
        return group;
    }

    createRackets() {
        this.playerRacket = this.createRacketMesh(0x3498db); // Blue
        this.playerRacket.visible = false; // Set invisible: pure tracking hitbox
        this.scene.add(this.playerRacket);
        
        // NEW: visual-only racket decoupled from hard tracking snaps
        this.playerRacketVisual = this.createRacketMesh(0x3498db);
        this.scene.add(this.playerRacketVisual);
        
        this.aiRacket = this.createRacketMesh(0xe74c3c); // Red
        this.scene.add(this.aiRacket);
    }

    resetShuttlePosition() {
        // Start on AI side
        this.shuttle.position.set(0, 1.5, -this.COURT.length/2 + 1.0);
        this.shuttleVelocity.set(0, 0, 0);
        this.shuttle.rotation.set(0,0,0);
        this.lastHitter = null;
    }

    serveShuttle() {
        // Reduced initial Y-arc to stay on screen, Z-speed restored to classic parameter
        this.shuttleVelocity.set((Math.random() - 0.5) * 1.5, 5.0, 11.5);
        this.gameState = 'playing';
        this.lastHitter = 'ai'; // AI serves to player
    }

    updateUI() {
        if(document.getElementById('scorePlayer')) document.getElementById('scorePlayer').textContent = this.scorePlayer;
        if(document.getElementById('scoreAI')) document.getElementById('scoreAI').textContent = this.scoreAI;
        if(document.getElementById('rally')) document.getElementById('rally').textContent = this.rallyCount;
    }

    resetPoint() {
        this.gameState = 'serving';
        this.rallyCount = 0;
        this.updateUI();
        
        // Let user see where it went out
        setTimeout(() => {
            this.resetShuttlePosition();
            setTimeout(() => {
                if (this.gameState === 'serving') this.serveShuttle();
            }, 600);
        }, 600);
    }

    updateRackets(landmarks, dtMs, dt) {
        if (landmarks && landmarks.length > 0) {
            const hand = landmarks[0];
            const tip = hand[8];
            const wrist = hand[0];
            const palm = hand[9];
            
            if (!tip || !wrist || !palm) {
                // Keep previous target instead of freezing
                this.racketTarget.copy(this.playerRacket.position);
            } else {
                // Advanced mapping using true Z-depth derived from wrist vs palm relationships
                const x = THREE.MathUtils.clamp((0.5 - tip.x) * 10.0, -this.COURT.width/2.5, this.COURT.width/2.5);
                const anchorY = (tip.y * 0.6) + (wrist.y * 0.4);
                const y = THREE.MathUtils.clamp(0.2 + (1 - anchorY) * 2.5, 0.2, 2.2); // Lowered vertical view
                
                // Stabilize Z-Depth mapping to prevent huge jumps
                const depthDiff = (wrist.z || 0) - (palm.z || 0);
                const z = THREE.MathUtils.clamp(6.0 + (depthDiff * 10.0), 4.0, 6.5);
                
                this.racketTarget.set(x, y, z);
            }
        } else {
            // Keep previous target instead of freezing perfectly
            this.racketTarget.copy(this.playerRacket.position);
        }
        
        // Compute hand velocity
        const handDelta = this.racketTarget.clone().sub(this.prevRacketPosition);

        // Predict next position (lead the motion slightly)
        const prediction = handDelta.multiplyScalar(0.6);

        // Final target with prediction
        const predictedTarget = this.racketTarget.clone().add(prediction);
        
        // Clamp Instead of Freezing on Large Movement
        const maxStep = 2.5; // max movement per frame
        const step = predictedTarget.clone().sub(this.playerRacket.position);

        if (step.length() > maxStep) {
            step.normalize().multiplyScalar(maxStep);
            this.playerRacket.position.add(step);
        } else {
            // Smooth but fast follow tracking
            this.playerRacket.position.lerp(predictedTarget, 0.75);
        }
        
        // Prevent Camera Escape
        this.playerRacket.position.z = THREE.MathUtils.clamp(
            this.playerRacket.position.z,
            3.5,
            6.5
        );
        
        // True velocity
        this.racketVelocity.copy(this.playerRacket.position).sub(this.prevRacketPosition).multiplyScalar(1000 / Math.max(1, dtMs));
        this.prevRacketPosition.copy(this.playerRacket.position);
        
        // Visual dynamic tilt
        if (this.racketVelocity.lengthSq() > 0.01) {
            const tilt = THREE.MathUtils.clamp(this.racketVelocity.y / 15, -0.6, 0.6);
            const yaw = -THREE.MathUtils.clamp(this.racketVelocity.x / 15, -0.6, 0.6);
            this.playerRacket.rotation.set(tilt, yaw, 0);
        }
        
        // Smooth visual racket locally (does NOT affect rigid hit detection)
        this.playerRacketVisual.position.lerp(this.playerRacket.position, 0.2);
        this.playerRacketVisual.rotation.x += (this.playerRacket.rotation.x - this.playerRacketVisual.rotation.x) * 0.2;
        this.playerRacketVisual.rotation.y += (this.playerRacket.rotation.y - this.playerRacketVisual.rotation.y) * 0.2;

        // AI Racket Logic
        const diff = this.DIFFICULTY[this.difficulty];
        
        // Only trigger AI if shuttle is approaching
        if (this.shuttleVelocity.z < 0 && this.shuttle.position.z < 1.0) {
            // Target is X position and intercept height
            const targetZ = -this.COURT.length/2 + 0.5;
            const flightTime = Math.abs((targetZ - this.shuttle.position.z) / this.shuttleVelocity.z);
            
            let targetX = this.shuttle.position.x + (this.shuttleVelocity.x * flightTime);
            // Simulate gravity for Y
            let targetY = this.shuttle.position.y + (this.shuttleVelocity.y * flightTime) + (0.5 * this.PHYSICS.gravity * flightTime * flightTime);
            
            // Dynamic rally continuation probability
            const baseChance = 0.7; // 70% initial
            const decay = 0.2;      // drop per rally
            const continueChance = Math.max(0.2, baseChance - (this.rallyCount * decay));
            
            // We use fixed scalars per-rally so the AI racket doesn't jitter from randomizing every frame
            const seed = (this.scorePlayer * 7 + this.scoreAI * 13 + this.rallyCount * 17) % 100;
            const willMiss = (seed / 100.0) > continueChance; 
            
            if (willMiss) {
                // Delay AI response slightly
                if (Math.random() < 0.5) {
                    return; // skip this frame → late movement
                }
                
                // Subtle error instead of obvious fake miss
                targetX += (Math.random() - 0.5) * 1.5; // slight misalignment
                
                // Slightly wrong height → mistimed hit
                targetY += (Math.random() - 0.5) * 1.0;
            } else {
                targetX += (seed % 5 - 2) * 0.1; // Normal variance
            }
            
            // Allow AI to reach higher up (was 2.5 previously causing overhead misses)
            targetY = Math.max(0.5, Math.min(4.5, targetY)); 
            targetX = Math.max(-this.COURT.width/2 - 2, Math.min(this.COURT.width/2 + 2, targetX));
            
            this.aiTarget.set(targetX, targetY, targetZ);
        } else {
            // Idle position in middle of their side lower down
            this.aiTarget.set(0, 1.2, -this.COURT.length/4);
        }
        
        const aiSpeed = diff.speed * dt;
        this.aiRacket.position.lerp(this.aiTarget, aiSpeed);
    }

    updateShuttle(dt) {
        if (this.gameState !== 'playing') return;
        
        // Cache previous position for CCD (Continuous Collision Detection)
        this.prevShuttlePosition.copy(this.shuttle.position);
        
        // Apply physics
        this.shuttleVelocity.y += this.PHYSICS.gravity * dt;
        
        // Air resistance heavily affects velocity in all directions!
        this.shuttleVelocity.multiplyScalar(this.PHYSICS.airResistance);
        
        this.shuttle.position.addScaledVector(this.shuttleVelocity, dt);
        
        // Point the shuttlecock in the direction of its velocity
        if (this.shuttleVelocity.lengthSq() > 0.1) {
            const lookPos = this.shuttle.position.clone().add(this.shuttleVelocity);
            this.shuttle.lookAt(lookPos);
            this.shuttle.rotateX(-Math.PI/2); // Adjust so skirt points backwards
        }
        
        // NET COLLISION (CCD Lite)
        const netTop = this.NET.height;
        const netZ = 0;
        
        // Check if shuttle crossed the net plane exactly rather than just overlapping Z bounds loosely
        const crossedNet = (this.prevShuttlePosition.z > netZ && this.shuttle.position.z <= netZ) || (this.prevShuttlePosition.z < netZ && this.shuttle.position.z >= netZ);

        if (crossedNet && this.shuttle.position.y < netTop) {
            // Snap shuttle to net plane (prevents visual pass-through)
            this.shuttle.position.z = netZ;
            // Add slight bounce instead of dead drop
            this.shuttleVelocity.z *= -0.2;
            this.shuttleVelocity.y *= 0.5;
            // Add tiny backward offset (prevents z-fighting against the net mesh visual)
            this.shuttle.position.z += (this.lastHitter === 'player' ? 0.02 : -0.02);
        }

        // Z boundary clamp / bounce
        if (Math.abs(this.shuttle.position.z) > this.COURT.length / 2 + 1.0) {
            this.shuttle.position.z = THREE.MathUtils.clamp(
                this.shuttle.position.z,
                -this.COURT.length / 2 - 1.0,
                this.COURT.length / 2 + 1.0
            );
            this.shuttleVelocity.z *= -1; // bounce back into play
        }

        // Check hits ground
        if (this.shuttle.position.y < this.SHUTTLE.radius) {
            // Determine who scored based on Z position
            if (this.shuttle.position.z > 0) {
                // Landed on player's side
                this.scoreAI++;
            } else {
                // Landed on AI's side
                this.scorePlayer++;
            }
            this.resetPoint();
            return;
        }

        // Out of bounds X checks
        if (Math.abs(this.shuttle.position.x) > this.COURT.width/2 + 2) {
            // Wide shot
            if (this.lastHitter === 'player') this.scoreAI++;
            else this.scorePlayer++;
            this.resetPoint();
        }
    }

    checkRacketCollision(racket, hitter, nowMs) {
        const isApproaching = (hitter === 'player' && this.shuttleVelocity.z > 0) || (hitter === 'ai' && this.shuttleVelocity.z < 0);
        if (!isApproaching) return;
        
        if (nowMs - this.lastHitTime < this.cooldownMs) return;
        
        const delta = this.shuttle.pos ? this.shuttle.pos.clone().sub(racket.position) : this.shuttle.position.clone().sub(racket.position);
        const distance = delta.length();
        const collisionDist = this.SHUTTLE.radius + this.RACKET.radius + 0.40; // Massive 0.40 margin of error sweet spot
        
        if (distance < collisionDist) {
            this.lastHitTime = nowMs;
            const outward = delta.clone().normalize();
            
            if (hitter === 'player') {
                const racketSpeed = this.racketVelocity.length();
                // We add intentionality - don't bounce if just floating and dropping
                const intentionalSwing = racketSpeed > 1.5 || this.racketVelocity.y > 1.5;
                if (!intentionalSwing && this.shuttleVelocity.z <= 0) return;
                
                const impactBoost = Math.min(3.0, racketSpeed);
                
                this.shuttleVelocity.x = (this.racketVelocity.x * 0.15);
                this.shuttleVelocity.y = 4.8 + Math.max(0, outward.y) * 1.2 + (impactBoost * 0.3);
                this.shuttleVelocity.z = -11.5 - impactBoost; 
                
                const netChance = Math.random();
                if (netChance < 0.10) {
                    this.shuttleVelocity.y *= 0.6; // 10% chance to hit net
                }
            } else {
                this.shuttleVelocity.x = (Math.random() - 0.5) * 1.5;
                this.shuttleVelocity.y = 4.8 + Math.random() * 0.8;
                this.shuttleVelocity.z = 11.5;
                
                // Re-evaluate global miss probability based on current rally
                const seed = (this.scorePlayer * 7 + this.scoreAI * 13 + this.rallyCount * 17) % 100;
                const baseChance = 0.7;
                const decay = 0.2;
                const continueChance = Math.max(0.2, baseChance - (this.rallyCount * decay));
                const willMiss = (seed / 100.0) > continueChance; 
                
                if (willMiss && Math.random() < 0.4) {
                    // Weak return → easy for player
                    this.shuttleVelocity.y *= 0.6;
                    this.shuttleVelocity.z *= 0.7;
                } else {
                    const minClearHeight = this.NET.height + 0.2;
                    if (this.shuttle.position.y < minClearHeight) {
                        this.shuttleVelocity.y += 2.0; // force lift
                    }
                }
                
                const netChance = Math.random();
                if (netChance < 0.10) {
                    // AI makes mistake → hits net
                    this.shuttleVelocity.y = 2.5; // too low → net collision likely
                }
            }
            
            this.lastHitter = hitter;
            this.rallyCount++;
            this.updateUI();
        }
    }

    startGame() {
        if(this.gameState === 'waiting') {
            this.scorePlayer = 0;
            this.scoreAI = 0;
            this.updateUI();
            this.resetPoint();
        }
    }

    updateAndRender(handPos, dtMs, landmarks, timestamp) {
        if(this.renderer.domElement.width !== this.renderer.domElement.clientWidth ||
           this.renderer.domElement.height !== this.renderer.domElement.clientHeight) {
            this.camera.aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight, false);
        }

        const dt = Math.min(dtMs / 1000, 0.05);

        this.updateRackets(landmarks, dtMs, dt);
        this.updateShuttle(dt);
        
        if (this.gameState === 'playing') {
            this.checkRacketCollision(this.playerRacket, 'player', timestamp || performance.now());
            this.checkRacketCollision(this.aiRacket, 'ai', timestamp || performance.now());
        }

        this.renderer.render(this.scene, this.camera);
    }
}
