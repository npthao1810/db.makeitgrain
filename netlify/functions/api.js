const serverless = require('serverless-http');
const app = require('../../backend/app');

// Netlify rewrites /api/* to this function. Reusing the Express app keeps the
// same API URLs locally and after deployment.
module.exports.handler = serverless(app);
