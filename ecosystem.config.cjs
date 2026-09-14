module.exports = {
  apps: [{
    name: "cctv",
    cwd: "/var/www/inventoryos.xyz/cctv",
    script: ".next/standalone/server.js",
    interpreter: "bun",

    env: {
      NODE_ENV: "production",
      PORT: "3004",
      HOSTNAME: "127.0.0.1"
    },

    autorestart: true,
    max_memory_restart: "700M"
  }]
};
