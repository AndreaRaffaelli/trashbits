
class Enemy {

    constructor({ x, y, ctx, health }) {

        this.x = x;
        this.y = y;
        this.ctx = ctx;

        /* this.image = new Image();
        this.image.src = "./sprites/enemy.gif";

        this.image.onload = () => {
            this.loaded = true;
        }; */

        this.maxHealth = 100;
        this.health = health;

        this.width = 40;
        this.height = 40;

        this.isdead = false;
    }

    draw() {

        if (this.isdead) {

            this.ctx.fillStyle = "black";
            this.ctx.fillRect(this.x, this.y, this.width, this.height);
            return;
        }


        this.ctx.fillStyle = "red";
        this.ctx.fillRect(this.x, this.y, this.width, this.height);

        this.drawHealthBar();
    }

    die() {
        this.isdead = true;
    }

    drawHealthBar() {

        const healthBarWidth = 80;
        const healthBarHeight = 6;

        const healthBarX = this.x + (this.width / 2) - (healthBarWidth / 2);
        const healthBarY = this.y - 10;

        // Drawing the health bar background

        this.ctx.fillStyle = "gray";
        this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);


        const healthPercentage = this.health / this.maxHealth;

        // Drawing the health bar
        this.ctx.fillStyle = "green";
        this.ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);
    
    }   
}