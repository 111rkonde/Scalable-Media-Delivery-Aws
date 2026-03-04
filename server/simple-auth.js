const crypto = require('crypto');

// Simple in-memory user store (in production, use a database)
const users = new Map();
const sessions = new Map();

class SimpleAuth {
  // Hash password
  static hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Generate session token
  static generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create session
  static createSession(user) {
    const token = this.generateSessionToken();
    const session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    
    sessions.set(token, session);
    return token;
  }

  // Verify session
  static verifySession(token) {
    const session = sessions.get(token);
    if (!session) {
      return null;
    }
    
    // Check if session expired
    if (new Date() > new Date(session.expiresAt)) {
      sessions.delete(token);
      return null;
    }
    
    return session;
  }

  // Register new user
  static register(username, email, password) {
    // Check if user already exists
    for (let [id, user] of users.entries()) {
      if (user.email === email || user.username === username) {
        return { success: false, message: 'User already exists' };
      }
    }

    // Create new user
    const userId = crypto.randomUUID();
    const hashedPassword = this.hashPassword(password);
    
    const newUser = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.set(userId, newUser);
    
    return { 
      success: true, 
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    };
  }

  // Login user
  static login(email, password) {
    const hashedPassword = this.hashPassword(password);
    
    for (let [id, user] of users.entries()) {
      if (user.email === email && user.password === hashedPassword) {
        const token = this.createSession(user);
        return {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
          }
        };
      }
    }
    
    return { success: false, message: 'Invalid credentials' };
  }

  // Get user by ID
  static getUserById(userId) {
    const user = users.get(userId);
    if (user) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      };
    }
    return null;
  }

  // Middleware to protect routes
  static authenticate(req, res, next) {
    console.log('SimpleAuth middleware called');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('Token received:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const session = this.verifySession(token);
    console.log('Session verification result:', session ? 'Valid' : 'Invalid');
    
    if (!session) {
      console.log('Invalid session');
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = session;
    console.log('User authenticated:', session.username);
    next();
  }

  // Logout
  static logout(token) {
    sessions.delete(token);
  }

  // Get all users (for admin purposes)
  static getAllUsers() {
    const userList = [];
    for (let [id, user] of users.entries()) {
      userList.push({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      });
    }
    return userList;
  }
}

module.exports = SimpleAuth;
