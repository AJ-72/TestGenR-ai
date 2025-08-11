// Real crypto implementation for Node.js environment
const { webcrypto } = require('crypto');
global.crypto = webcrypto;