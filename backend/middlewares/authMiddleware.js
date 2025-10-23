const jwt = require('jsonwebtoken');
const config = require('../config/default');

module.exports = function (req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ success: false, message: 'Missing Authorization header' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ success: false, message: 'Invalid Authorization header' });

  const scheme = parts[0];
  const token = parts[1];
  if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ success: false, message: 'Malformed Authorization header' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
