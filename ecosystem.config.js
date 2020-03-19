module.exports = {
  apps : [{
    name: 'API',
    script: './bin/www',
    instances: 2,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
