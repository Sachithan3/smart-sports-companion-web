// src/games/badminton.js

export class BadmintonGame {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        // Game state
        this.score = 0;
        this.highScore = 0;
        this.gravity = 1400; // pixels per second squared
        this.drag = 0.992; // Air resistance on velocity
        this.cooldownMs = 450;
        this.lastHitTime = 0;
        this.particles = [];
        this.screenShakeAmount = 0;
        this.screenShakeAmount = 0;

        // Racket state
        this.racket = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 65, // Base Hitbox size - slightly larger for forgiveness
            vx: 0,
            vy: 0,
            history: [] // Last few positions to calculate swing velocity
        };
        
        // Birdie state
        this.birdie = {
            x: this.canvas.width / 2,
            y: 50,
            vx: 0,
            vy: 0,
            radius: 8,
            rotation: 0
        };

        this.resetBirdie();
    }

    resetBirdie() {
        this.birdie.x = this.canvas.width / 2;
        this.birdie.y = 50;
        // Launch it slightly upward to give player time
        this.birdie.vx = (Math.random() * 300) - 150;
        this.birdie.vy = -(Math.random() * 200 + 100);
    }

    updateRacket(handX, handY, dtMs) {
        const now = performance.now();
        this.racket.history.push({ x: handX, y: handY, time: now });
        
        // Keep a short history for velocity calculation (~100ms window)
        while (this.racket.history.length > 0 && now - this.racket.history[0].time > 100) {
            this.racket.history.shift();
        }

        if (this.racket.history.length >= 2) {
            const oldest = this.racket.history[0];
            const newest = this.racket.history[this.racket.history.length - 1];
            const timeDiff = (newest.time - oldest.time) / 1000; // in seconds
            
            if (timeDiff > 0.01) {
                // Smooth exponential moving average for velocity to avoid noise spikes
                const rawVx = (newest.x - oldest.x) / timeDiff;
                const rawVy = (newest.y - oldest.y) / timeDiff;
                
                this.racket.vx = this.racket.vx * 0.4 + rawVx * 0.6;
                this.racket.vy = this.racket.vy * 0.4 + rawVy * 0.6;
            }
        } else {
            this.racket.vx = 0;
            this.racket.vy = 0;
        }

        // Apply position with a light EMA for smoothness
        this.racket.x = this.racket.x * 0.3 + handX * 0.7;
        this.racket.y = this.racket.y * 0.3 + handY * 0.7;
    }

    update(landmarks, dtMs, nowMs) {
        const dt = dtMs / 1000; // converted to seconds

        // Update Racket Position
        if (landmarks && landmarks.length > 0) {
            // Index finger tip is landmark 8
            const handTip = landmarks[0][8];
            // X is mirrored in the camera view usually, but assuming the base game handles mirroring outside or we do it here.
            // Our existing game canvas doesn't flip, MediaPipe returns mirrored coords if camera is mirrored.
            // We just map cleanly to canvas width/height.
            // Since it's a front-facing camera, we might want to invert X for natural movement.
            const handX = (1 - handTip.x) * this.canvas.width;
            const handY = handTip.y * this.canvas.height;
            
            this.updateRacket(handX, handY, dtMs);
        }

        // Apply Physics to Birdie
        this.birdie.vy += this.gravity * dt;
        
        // Air resistance (drag)
        this.birdie.vx *= Math.pow(this.drag, dtMs);
        this.birdie.vy *= Math.pow(this.drag, dtMs);

        this.birdie.x += this.birdie.vx * dt;
        this.birdie.y += this.birdie.vy * dt;

        // Wall collisions
        if (this.birdie.x < this.birdie.radius) {
            this.birdie.x = this.birdie.radius;
            this.birdie.vx *= -0.6; // bounce and lose momentum
        } else if (this.birdie.x > this.canvas.width - this.birdie.radius) {
            this.birdie.x = this.canvas.width - this.birdie.radius;
            this.birdie.vx *= -0.6;
        }

        // Ceiling collision (bounce down)
        if (this.birdie.y < this.birdie.radius) {
            this.birdie.y = this.birdie.radius;
            this.birdie.vy = Math.abs(this.birdie.vy) * 0.5;
        }

        // Ground collision -> Game Over / Drop
        if (this.birdie.y > this.canvas.height) {
            if (this.score > this.highScore) {
                this.highScore = this.score;
            }
            this.score = 0;
            this.screenShakeAmount = 10;
            this.spawnParticles(this.birdie.x, this.canvas.height, 20, '#e74c3c');
            this.resetBirdie();
        }

        this.checkSwingCollision(nowMs);
        this.updateParticles();
    }

    checkSwingCollision(nowMs) {
        const dx = this.birdie.x - this.racket.x;
        const dy = this.birdie.y - this.racket.y;
        const distance = Math.hypot(dx, dy);

        const speed = Math.hypot(this.racket.vx, this.racket.vy);
        
        // If hand is moving very fast, artificially expand the hitbox to account for skipped frames
        const dynamicRadius = this.racket.radius + (speed > 500 ? 40 : 0);

        // Collision check
        if (distance < dynamicRadius + this.birdie.radius) {
            if (nowMs - this.lastHitTime > this.cooldownMs) {
                const swingThreshold = 400; // px/s

                if (speed > swingThreshold) {
                    this.registerHit(nowMs, true);
                } else if (this.racket.vy < -100) {
                    // A slow upward tap
                    this.registerHit(nowMs, false);
                } else if (this.birdie.vy > 0) {
                     // Birdie is falling on the racket, just pop it up slightly
                     this.birdie.vy = -400;
                     this.birdie.vx += (Math.random() - 0.5) * 100;
                     this.lastHitTime = nowMs;
                     this.score++;
                }
            }
        }
    }

    registerHit(nowMs, isHardSwing) {
        this.score++;
        this.lastHitTime = nowMs;
        
        const elasticity = 0.85; // How much of our hand's velocity goes into the birdie
        
        // Transfer velocity
        let hitVx = this.racket.vx * elasticity;
        let hitVy = this.racket.vy * elasticity;
        
        // Ensure a minimum upward trajectory so it doesn't spike down immediately
        if (hitVy > -300) {
            hitVy -= 400; // Add an upward pop
        }
        
        // Cap max vertical velocity
        hitVy = Math.max(hitVy, -1200); 

        // Apply new velocities
        this.birdie.vx = hitVx + (this.birdie.vx * -0.2); // Counter a bit of the incoming speed
        this.birdie.vy = hitVy;

        this.screenShakeAmount = isHardSwing ? 6 : 2;
        this.spawnParticles(this.birdie.x, this.birdie.y, isHardSwing ? 15 : 5, '#ecf0f1');
    }

    spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: Math.random() > 0.5 ? color : '#ffffff'
            });
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles.length ? this.particles[i] : null;
            if(!p) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        // Screen shake
        this.screenShakeAmount *= 0.9;
        const shakeX = this.screenShakeAmount > 0.5 ? (Math.random() * 2 - 1) * this.screenShakeAmount : 0;
        const shakeY = this.screenShakeAmount > 0.5 ? (Math.random() * 2 - 1) * this.screenShakeAmount : 0;

        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);

        // Background / Court
        this.ctx.fillStyle = "#27ae60"; // Green court
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Court lines
        this.ctx.strokeStyle = "rgba(255,255,255,0.4)";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(40, 40, this.canvas.width - 80, this.canvas.height - 80);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 40);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height - 40);
        this.ctx.stroke();

        // Draw Score
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        this.ctx.font = "bold 140px system-ui";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(this.score.toString(), this.canvas.width / 2, this.canvas.height / 2);
        
        // Draw High Score
        if (this.highScore > 0) {
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            this.ctx.font = "bold 24px system-ui";
            this.ctx.fillText("HIGH SCORE: " + this.highScore, this.canvas.width / 2, this.canvas.height / 2 + 100);
        }

        // Draw Particles
        for (const p of this.particles) {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Draw Racket (Badminton style)
        // Draw Handle
        let angle = Math.atan2(this.racket.vy, this.racket.vx);
        if (Math.hypot(this.racket.vx, this.racket.vy) < 50) angle = -Math.PI / 2; // Point UP by default

        this.ctx.beginPath();
        this.ctx.moveTo(this.racket.x - Math.cos(angle)*30, this.racket.y - Math.sin(angle)*30);
        this.ctx.lineTo(this.racket.x - Math.cos(angle)*100, this.racket.y - Math.sin(angle)*100);
        this.ctx.strokeStyle = "#2c3e50"; // Dark handle
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = "round";
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.ellipse(this.racket.x, this.racket.y, this.racket.radius, this.racket.radius * 1.3, angle, 0, Math.PI * 2);
        this.ctx.strokeStyle = "#ecf0f1";
        this.ctx.lineWidth = 6;
        this.ctx.stroke();
        
        // Racket strings (simple hash)
        this.ctx.save();
        this.ctx.translate(this.racket.x, this.racket.y);
        this.ctx.rotate(angle);
        this.ctx.beginPath();
        for(let i=-20; i<=20; i+=10) {
            this.ctx.moveTo(i, -30);
            this.ctx.lineTo(i, 30);
            this.ctx.moveTo(-30, i);
            this.ctx.lineTo(30, i);
        }
        this.ctx.strokeStyle = "rgba(255,255,255,0.4)";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.restore();


        // Draw Birdie
        // The birdie orientation follows its velocity direction
        const birdieAngle = Math.atan2(this.birdie.vy, this.birdie.vx);
        this.ctx.save();
        this.ctx.translate(this.birdie.x, this.birdie.y);
        this.ctx.rotate(birdieAngle);

        // Feathers (triangle shape trailing behind velocity vector)
        this.ctx.beginPath();
        this.ctx.moveTo(5, 0); // nose point
        this.ctx.lineTo(-20, -12); // top feather edge
        this.ctx.lineTo(-20, 12); // bottom feather edge
        this.ctx.closePath();
        this.ctx.fillStyle = "#ecf0f1";
        this.ctx.fill();
        this.ctx.strokeStyle = "#bdc3c7";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Feather lines
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-20, -6);
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-20, 6);
        this.ctx.stroke();

        // Cork (rounded nose pointing in velocity direction)
        this.ctx.beginPath();
        this.ctx.arc(4, 0, this.birdie.radius, -Math.PI/2, Math.PI/2);
        this.ctx.fillStyle = "#f1c40f"; // Yellow cork
        this.ctx.fill();

        this.ctx.restore();
        this.ctx.restore();
    }
}
