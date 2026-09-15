const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  try {
    const cookie = req.headers.cookie?.match(/(?:^|;\s*)admin_token=([^;]+)/)?.[1];
    const header = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = cookie || header;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
};
