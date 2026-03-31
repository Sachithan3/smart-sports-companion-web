// src/games/badminton3D.js

export class Badminton3D {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Game Constants - Badminton Scale
        this.COURT = { width: 6.1, length: 13.4, height: 0 };
        this.NET = { height: 1.55, thickness: 0.02 };
        this.SHUTTLE = { radius: 0.08, mass: 0.005 }; // Massively visible shuttle
        this.RACKET = { radius: 0.12, thickness: 0.02, handleLength: 0.6 }; // Scaled down to fit tightly in view
        
        this.PHYSICS = {
            gravity: -8.0,      // Heavier gravity for parabolic arcs
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
        const stringGeo = new THREE.CylinderGeometry(this.RACKET.radius, this.RACKET.radius, 0.005, 32);
        const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        const strings = new THREE.Mesh(stringGeo, stringMat);
        strings.rotation.x = Math.PI / 2;
        group.add(strings);
        
        return group;
    }

    createRackets() {
        this.playerRacket = this.createRacketMesh(0x3498db); // Blue
        this.scene.add(this.playerRacket);
        
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
        // Positively flying towards the player player at Z=6.0, reaching the camera
        this.shuttleVelocity.set((Math.random() - 0.5) * 2.0, 3.5, 13.0);
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
            
            // Advanced mapping using true Z-depth derived from wrist vs palm relationships
            const x = THREE.MathUtils.clamp((0.5 - tip.x) * 10.0, -this.COURT.width/2.5, this.COURT.width/2.5);
            const anchorY = (tip.y * 0.6) + (wrist.y * 0.4);
            const y = THREE.MathUtils.clamp(0.2 + (1 - anchorY) * 2.5, 0.2, 2.2); // Lowered vertical view
            
            // Evaluate Z depth depth difference
            const depthDiff = (wrist.z || 0) - (palm.z || 0);
            const z = THREE.MathUtils.clamp(6.0 + (depthDiff * 25.0), 3.5, 6.5); // Stops right before camera
            
            this.racketTarget.set(x, y, z);
            
            // Smooth lerp instead of jittery pos injection
            const alpha = Math.min(1, (dtMs / 16.67) * 0.35);
            this.playerRacket.position.lerp(this.racketTarget, alpha);
            
            // True velocity
            this.racketVelocity.copy(this.playerRacket.position).sub(this.prevRacketPosition).multiplyScalar(1000 / Math.max(1, dtMs));
            this.prevRacketPosition.copy(this.playerRacket.position);
            
            // Visual dynamic tilt
            if (this.racketVelocity.lengthSq() > 0.01) {
                const tilt = THREE.MathUtils.clamp(this.racketVelocity.y / 15, -0.6, 0.6);
                const yaw = -THREE.MathUtils.clamp(this.racketVelocity.x / 15, -0.6, 0.6);
                this.playerRacket.rotation.set(tilt, yaw, 0);
            }
        }

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
            
            targetX += (Math.random() - 0.5) * diff.errorMargin;
            targetY = Math.max(0.2, Math.min(2.5, targetY)); // Bound AI height heavily downward
            targetX = Math.max(-this.COURT.width/2, Math.min(this.COURT.width/2, targetX));
            
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
        if (this.lastHitter === hitter && this.shuttleVelocity.z * (hitter === 'player' ? -1 : 1) > 0) {
           return;
        }
        
        if (nowMs - this.lastHitTime < this.cooldownMs) return;
        
        const delta = this.shuttle.pos ? this.shuttle.pos.clone().sub(racket.position) : this.shuttle.position.clone().sub(racket.position);
        const distance = delta.length();
        const collisionDist = this.SHUTTLE.radius + this.RACKET.radius + 0.1; // generous sweet spot
        
        if (distance < collisionDist) {
            this.lastHitTime = nowMs;
            const outward = delta.clone().normalize();
            
            if (hitter === 'player') {
                const racketSpeed = this.racketVelocity.length();
                // We add intentionality - don't bounce if just floating and dropping
                const intentionalSwing = racketSpeed > 1.5 || this.racketVelocity.y > 1.5;
                if (!intentionalSwing && this.shuttleVelocity.z <= 0) return;
                
                let power = 15.0; // Consistently reach backcourt
                
                this.shuttleVelocity.x = (this.racketVelocity.x * 0.2) + (outward.x * 2.5);
                this.shuttleVelocity.y = 3.5 + (this.racketVelocity.y * 0.1) + Math.max(0, outward.y) * 2.5;
                this.shuttleVelocity.z = -power; 
            } else {
                let power = 15.0;
                this.shuttleVelocity.x = (Math.random() - 0.5) * 3.0 + (outward.x * 1.5);
                this.shuttleVelocity.y = 4.0 + (Math.random() * 1.5) + Math.max(0, outward.y) * 2.0;
                this.shuttleVelocity.z = power; 
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
