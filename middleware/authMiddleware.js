const jwt = require('jsonwebtoken');

// Protects routes for users with 'admin' role
exports.isAdmin = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    console.log('❌ No JWT token found, redirecting to login');
    return res.redirect('/login');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('❌ JWT verification failed:', err.message);
      res.clearCookie('jwt');
      return res.redirect('/login');
    }
    
    console.log('🔍 Admin Middleware Debug:');
    console.log('Decoded token:', decoded);
    console.log('User role:', decoded.role);
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      console.log('❌ User is not admin, redirecting to user dashboard');
      return res.redirect('/user/dashboard');
    }
    
    console.log('✅ User is admin, proceeding to admin route');
    req.user = decoded;
    next();
  });
};

// Protects routes for users (admin or user)
exports.isAuthenticated = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.redirect('/login');

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      res.clearCookie('jwt');
      return res.redirect('/login');
    }
    req.user = decoded;
    next();
  });
};

// Protect admin routes (alternative implementation)
exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.redirect('/user/dashboard');
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.clearCookie('jwt');
    return res.redirect('/login');
  }
};



