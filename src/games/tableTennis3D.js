// src/games/tableTennis3D.js

export class TableTennis3D {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Game Constants
        this.TABLE = { width: 2.74, length: 1.525, height: 0.76, thickness: 0.05 };
        this.NET = { height: 0.1525, thickness: 0.01 };
        this.BALL = { radius: 0.02, mass: 0.0027 };
        this.PADDLE = { radius: 0.12, thickness: 0.015 }; // Double the size for easier hitting
        
        this.PHYSICS = {
            gravity: -4.5,
            airResistance: 0.995,
            tableRestitution: 0.88,
            paddleRestitution: 1.05,
            spinFactor: 0.3
        };
        
        this.DIFFICULTY = {
            easy: { reactionDelay: 0.25, errorMargin: 0.12, speed: 3.5, returnSpeed: 1.8 },
            medium: { reactionDelay: 0.15, errorMargin: 0.06, speed: 5.0, returnSpeed: 2.2 },
            hard: { reactionDelay: 0.08, errorMargin: 0.02, speed: 7.0, returnSpeed: 2.8 }
        };

        // Game State
        this.gameState = 'waiting';
        this.scorePlayer = 0;
        this.scoreAI = 0;
        this.rallyCount = 0;
        this.difficulty = 'medium';
        this.ballVelocity = new THREE.Vector3();
        this.ballSpin = new THREE.Vector3();
        this.aiTarget = new THREE.Vector3();
        this.aiReactionTime = 0;
        this.lastHitter = null;
        this.bounceCountAI = 0;
        this.bounceCountPlayer = 0;
        
        // Tracking state
        this.lastHitTime = 0;
        this.cooldownMs = 80;
        this.paddleTarget = new THREE.Vector3();
        this.paddleVelocity = new THREE.Vector3();
        this.prevPaddlePosition = new THREE.Vector3(0, 0, 0);

        this.initScene();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 5, 15);
        
        this.camera = new THREE.PerspectiveCamera(60, this.canvas.width / this.canvas.height, 0.1, 100);
        this.camera.position.set(0, 2.5, 3);
        this.camera.lookAt(0, this.TABLE.height, 0);
        
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(3, 5, 2);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);
        
        const fillLight = new THREE.DirectionalLight(0x6699ff, 0.3);
        fillLight.position.set(-3, 3, -2);
        this.scene.add(fillLight);
        
        const rimLight = new THREE.DirectionalLight(0xff6699, 0.2);
        rimLight.position.set(0, 2, -3);
        this.scene.add(rimLight);
        
        this.createTable();
        this.createNet();
        this.createBall();
        this.createPaddles();
        this.createEnvironment();
        
        this.clock = new THREE.Clock();
    }

    createTable() {
        const geometry = new THREE.BoxGeometry(this.TABLE.width, this.TABLE.thickness, this.TABLE.length);
        const material = new THREE.MeshStandardMaterial({ color: 0x1a5c3f, roughness: 0.3, metalness: 0.1 });
        this.table = new THREE.Mesh(geometry, material);
        this.table.position.y = this.TABLE.height;
        this.table.receiveShadow = true;
        this.table.castShadow = true;
        this.scene.add(this.table);
        
        const lineGeo = new THREE.BoxGeometry(this.TABLE.width, 0.002, 0.02);
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const centerLine = new THREE.Mesh(lineGeo, lineMat);
        centerLine.position.set(0, this.TABLE.height + this.TABLE.thickness/2 + 0.001, 0);
        this.scene.add(centerLine);
        
        const edgeThickness = 0.02;
        const edges = [
            { w: this.TABLE.width, d: edgeThickness, x: 0, z: this.TABLE.length/2 - edgeThickness/2 },
            { w: this.TABLE.width, d: edgeThickness, x: 0, z: -this.TABLE.length/2 + edgeThickness/2 },
            { w: edgeThickness, d: this.TABLE.length, x: this.TABLE.width/2 - edgeThickness/2, z: 0 },
            { w: edgeThickness, d: this.TABLE.length, x: -this.TABLE.width/2 + edgeThickness/2, z: 0 }
        ];
        
        edges.forEach(edge => {
            const geo = new THREE.BoxGeometry(edge.w, 0.002, edge.d);
            const mesh = new THREE.Mesh(geo, lineMat);
            mesh.position.set(edge.x, this.TABLE.height + this.TABLE.thickness/2 + 0.001, edge.z);
            this.scene.add(mesh);
        });
    }

    createNet() {
        const netGeometry = new THREE.BoxGeometry(this.TABLE.width, this.NET.height, this.NET.thickness);
        const netMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.7, wireframe: true });
        this.net = new THREE.Mesh(netGeometry, netMaterial);
        this.net.position.set(0, this.TABLE.height + this.NET.height/2, 0);
        this.scene.add(this.net);
    }

    createBall() {
        const geometry = new THREE.SphereGeometry(this.BALL.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.4, metalness: 0.1, emissive: 0xff3300, emissiveIntensity: 0.2 });
        this.ball = new THREE.Mesh(geometry, material);
        this.ball.castShadow = true;
        this.scene.add(this.ball);
        
        const glowGeo = new THREE.SphereGeometry(this.BALL.radius * 1.3, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.2 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        this.ball.add(glow);
        
        this.resetBallPosition();
    }

    createPaddle(color, emissive) {
        const group = new THREE.Group();
        // Face
        const faceGeo = new THREE.CylinderGeometry(this.PADDLE.radius, this.PADDLE.radius, this.PADDLE.thickness, 28);
        const faceMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2, emissive: emissive, emissiveIntensity: 0.3 });
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.rotation.x = Math.PI / 2; // Face forward vertically 
        face.castShadow = true;
        group.add(face);

        // Handle
        const handleGeo = new THREE.CylinderGeometry(this.PADDLE.radius/6, this.PADDLE.radius/6, this.PADDLE.radius*2.5, 12);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x2f2f36, roughness: 0.8 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(0, -this.PADDLE.radius*1.2, 0); // Extend downwards
        handle.castShadow = true;
        group.add(handle);
        return group;
    }

    createPaddles() {
        this.playerPaddle = this.createPaddle(0x00ff88, 0x00ff88);
        this.playerPaddle.castShadow = true;
        this.scene.add(this.playerPaddle);
        
        this.aiPaddle = this.createPaddle(0xff3366, 0xff3366);
        this.aiPaddle.castShadow = true;
        this.aiPaddle.position.set(0, this.TABLE.height + 0.15, -this.TABLE.length/2 + 0.15);
        this.scene.add(this.aiPaddle);
    }

    createEnvironment() {
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        const gridHelper = new THREE.GridHelper(20, 40, 0x00ff88, 0x1a3a2e);
        gridHelper.material.opacity = 0.15;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    resetBallPosition() {
        this.ball.position.set(0, this.TABLE.height + 0.02, this.TABLE.length/4); // Rest it on the table
        this.ballVelocity.set(0, 0, 0);
        this.ballSpin.set(0, 0, 0);
        this.lastHitter = null;
    }

    serveBall() {
        const params = this.DIFFICULTY[this.difficulty];
        this.ballVelocity.set((Math.random() - 0.5) * 0.8, 1.2, -params.returnSpeed);
        this.gameState = 'playing';
        this.lastHitter = 'player';
    }

    updateUI() {
        document.getElementById('scorePlayer').textContent = this.scorePlayer;
        document.getElementById('scoreAI').textContent = this.scoreAI;
        document.getElementById('rally').textContent = this.rallyCount;
    }

    resetPoint() {
        this.gameState = 'serving';
        this.rallyCount = 0;
        this.bounceCountAI = 0;
        this.bounceCountPlayer = 0;
        this.updateUI();
        
        // Let user see where it went out for a second
        setTimeout(() => {
            this.resetBallPosition();
            setTimeout(() => {
                if (this.gameState === 'serving') this.serveBall();
            }, 600); // Serve quickly after reset
        }, 600);
    }

    updatePaddles(landmarks, dtMs, dt) {
        if (landmarks && landmarks.length > 0) {
            const hand = landmarks[0];
            const tip = hand[8];
            const wrist = hand[0];
            const palm = hand[9];
            
            // X mapping
            const x = THREE.MathUtils.clamp((0.5 - tip.x) * this.TABLE.width * 2.0, -this.TABLE.width * 0.8, this.TABLE.width * 0.8);
            
            // Y mapping
            const anchorY = (tip.y * 0.7) + (wrist.y * 0.3);
            const y = THREE.MathUtils.clamp(this.TABLE.height + 0.05 + (1 - anchorY) * 0.8, this.TABLE.height, this.TABLE.height + 1.0);
            
            // True Z depth derived from wrist vs palm relationships
            const depthDiff = (wrist.z || 0) - (palm.z || 0);
            const z = THREE.MathUtils.clamp((this.TABLE.length / 2 + 0.1) + depthDiff * 6.0, this.TABLE.length/2 - 0.2, this.TABLE.length/2 + 0.4);
            
            this.paddleTarget.set(x, y, z);
            
            // Smooth lerp instead of jittery pos injection
            const alpha = Math.min(1, (dtMs / 16.67) * 0.35);
            this.playerPaddle.position.lerp(this.paddleTarget, alpha);
            
            // True velocity calculations
            this.paddleVelocity.copy(this.playerPaddle.position).sub(this.prevPaddlePosition).multiplyScalar(1000 / Math.max(1, dtMs));
            this.prevPaddlePosition.copy(this.playerPaddle.position);
            
            // Visual dynamic tilt
            if (this.paddleVelocity.lengthSq() > 0.01) {
                const tilt = THREE.MathUtils.clamp(this.paddleVelocity.y / 15, -0.4, 0.4);
                const yaw = -THREE.MathUtils.clamp(this.paddleVelocity.x / 15, -0.4, 0.4);
                this.playerPaddle.rotation.set(tilt, yaw, 0);
            }
        }
        
        // AI Paddle
        const params = this.DIFFICULTY[this.difficulty];
        if (this.ballVelocity.z < -0.1 && this.ball.position.z < 0.2) {
            this.aiReactionTime += dt;
            if (this.aiReactionTime > params.reactionDelay) {
                const targetZ = -this.TABLE.length/2 + 0.15;
                const prediction = this.predictBallPosition(this.ball.position, this.ballVelocity, targetZ);
                if (prediction) {
                    this.aiTarget.x = prediction.x + (Math.random() - 0.5) * params.errorMargin;
                    this.aiTarget.y = prediction.y;
                    this.aiTarget.z = targetZ;
                    this.aiTarget.x = Math.max(-this.TABLE.width/2 + this.PADDLE.radius, Math.min(this.TABLE.width/2 - this.PADDLE.radius, this.aiTarget.x));
                    this.aiTarget.y = Math.max(this.TABLE.height + 0.05, Math.min(this.TABLE.height + 0.5, this.aiTarget.y));
                }
            }
        } else {
            this.aiReactionTime = 0;
            this.aiTarget.set(0, this.TABLE.height + 0.15, -this.TABLE.length/2 + 0.15);
        }
        
        const speed = Math.min(params.speed * dt, 1.0);
        this.aiPaddle.position.x += (this.aiTarget.x - this.aiPaddle.position.x) * speed;
        this.aiPaddle.position.y += (this.aiTarget.y - this.aiPaddle.position.y) * speed;
        this.aiPaddle.position.z += (this.aiTarget.z - this.aiPaddle.position.z) * speed;
    }

    predictBallPosition(pos, vel, targetZ) {
        if (Math.abs(vel.z) < 0.01) return null;
        const t = (targetZ - pos.z) / vel.z;
        if (t < 0 || t > 5) return null;
        return {
            x: pos.x + vel.x * t,
            y: pos.y + vel.y * t + 0.5 * this.PHYSICS.gravity * t * t,
            z: targetZ
        };
    }

    updateBall(dt, nowMs) {
        if (this.gameState !== 'playing') return;

        
        this.ballVelocity.y += this.PHYSICS.gravity * dt;
        this.ballVelocity.multiplyScalar(this.PHYSICS.airResistance);
        
        this.ball.position.x += this.ballVelocity.x * dt;
        this.ball.position.y += this.ballVelocity.y * dt;
        this.ball.position.z += this.ballVelocity.z * dt;
        
        this.ball.rotation.x += this.ballSpin.x * dt * 10;
        this.ball.rotation.y += this.ballSpin.y * dt * 10;
        this.ball.rotation.z += this.ballSpin.z * dt * 10;
        
        // Table bounce check
        const tableTop = this.TABLE.height + this.TABLE.thickness/2;
        if (this.ball.position.y - this.BALL.radius <= tableTop && this.ballVelocity.y < 0) {
            // Check if ball is actually above the table area
            if (this.ball.position.x > -this.TABLE.width/2 && this.ball.position.x < this.TABLE.width/2 &&
                this.ball.position.z > -this.TABLE.length/2 && this.ball.position.z < this.TABLE.length/2) {
                
                // Force bounce natively matching ref logic
                this.ball.position.y = tableTop + this.BALL.radius;
                this.ballVelocity.y = Math.abs(this.ballVelocity.y) * this.PHYSICS.tableRestitution;
                this.ballVelocity.x += this.ballSpin.y * this.PHYSICS.spinFactor * 0.05;
                this.ballVelocity.z += this.ballSpin.x * this.PHYSICS.spinFactor * 0.05;
                this.ballSpin.multiplyScalar(0.9);
                
                // Update Bounces for scoring
                if (this.ball.position.z > 0) {
                    this.bounceCountPlayer++;
                    if (this.bounceCountPlayer > 1 && this.lastHitter === 'player') {
                        // Double bounce on players side -> player loses
                        this.scoreAI++;
                        this.resetPoint();
                    }
                } else {
                    this.bounceCountAI++;
                    if (this.bounceCountAI > 1 && this.lastHitter === 'ai') {
                        // Double bounce on AI side -> AI loses
                        this.scorePlayer++;
                        this.resetPoint();
                    }
                }
            }
        }
        
        // Net Collision check
        if (Math.abs(this.ball.position.z) < this.NET.thickness/2 + this.BALL.radius && 
            this.ball.position.y < this.TABLE.height + this.NET.height) {
            // Bounce off net
            this.ballVelocity.z *= -0.4;
            this.ballVelocity.x *= 0.5;
        }
        
        this.checkPaddleCollision(this.playerPaddle, 'player', nowMs);
        this.checkPaddleCollision(this.aiPaddle, 'ai', nowMs);
        
        // Check out of bounds
        if (this.ball.position.y < 0.2) {
            // Ball fell to floor. Did it bounce properly on the opponent's side first?
            if (this.lastHitter === 'player' && this.bounceCountAI >= 1) {
                this.scorePlayer++;
            } else if (this.lastHitter === 'ai' && this.bounceCountPlayer >= 1) {
                this.scoreAI++;
            } else if (this.lastHitter === 'player') {
                this.scoreAI++; // Missed table
            } else {
                this.scorePlayer++; // AI missed table
            }
            this.resetPoint();
        }
    }

    checkPaddleCollision(paddle, hitter, nowMs) {
        if (this.lastHitter === hitter) return;
        if (nowMs - this.lastHitTime < this.cooldownMs) return;
        
        const distance = this.ball.position.distanceTo(paddle.position);
        const collisionDist = this.BALL.radius + this.PADDLE.radius;
        
        if (distance < collisionDist) {
            this.lastHitTime = nowMs;
            const normal = new THREE.Vector3().subVectors(this.ball.position, paddle.position).normalize();
            const approachSpeed = -this.ballVelocity.dot(normal);
            
            if (approachSpeed > 0) {
                this.bounceCountPlayer = 0; // reset bounces on hit
                this.bounceCountAI = 0;
                
                const reflection = normal.clone().multiplyScalar(2 * approachSpeed);
                this.ballVelocity.add(reflection);
                this.ballVelocity.multiplyScalar(this.PHYSICS.paddleRestitution);
                
                if (hitter === 'player') {
                    // Inject true 3D hand velocity based spin + velocity
                    this.ballVelocity.x += this.paddleVelocity.x * 0.3;
                    this.ballVelocity.y += Math.abs(this.paddleVelocity.y) * 0.3;
                    this.ballVelocity.z += this.paddleVelocity.z * 0.3;
                    this.ballSpin.set(-this.paddleVelocity.y * 3, -this.paddleVelocity.x * 3, 0);
                } else {
                    this.ballVelocity.x += (Math.random() - 0.5) * 0.5;
                    this.ballVelocity.y += 0.3 + Math.random() * 0.3;
                    if (this.ballVelocity.z < 0) this.ballVelocity.z = Math.abs(this.ballVelocity.z);
                }
                
                const minSpeed = 1.5;
                if (this.ballVelocity.length() < minSpeed) {
                    this.ballVelocity.normalize().multiplyScalar(minSpeed);
                }
                
                const separation = collisionDist - distance + 0.01;
                this.ball.position.add(normal.multiplyScalar(separation));
                
                this.lastHitter = hitter;
                this.rallyCount++;
                this.updateUI();
            }
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
        // Handle aspect ratio
        if(this.renderer.domElement.width !== this.renderer.domElement.clientWidth ||
           this.renderer.domElement.height !== this.renderer.domElement.clientHeight) {
            this.camera.aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight, false);
        }

        const dt = Math.min(dtMs / 1000, 0.05);

        this.updatePaddles(landmarks, dtMs, dt);
        this.updateBall(dt, timestamp || performance.now());
        
        // Slight camera sway
        this.camera.position.x = Math.sin(Date.now() * 0.0001) * 0.1;

        this.renderer.render(this.scene, this.camera);
    }
}
