/** PM2 process definitions for FX Prime Academy VPS deployment */
module.exports = {
  apps: [
    {
      name: "4005-fx-prime-backend",
      cwd: "/var/www/fxprime/backend",
      script: "bun",
      args: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4005,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: "3005-fxprime-frontend",
      cwd: "/var/www/fxprime/frontend",
      script: "bun",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: 3005,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
}
