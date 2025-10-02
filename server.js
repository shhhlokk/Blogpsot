const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'your-super-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day session
}));

// Create a connection pool to the MySQL database
const pool = mysql.createPool({
    host: 'database-1.c5k0amm2utg0.ap-south-1.rds.amazonaws.com',      // Your MySQL host
    user: 'admin',           // Your MySQL username
    password: 'admin2005', // <<-- IMPORTANT: Change this to your MySQL root password
    database: 'blog_db'
}).promise();


// --- Security Middleware ---
// Checks if a user is logged in and has the 'admin' role
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden: Requires admin privileges' });
};

// --- Authentication & User Routes ---

// POST: Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        // Check for duplicate username error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// POST: Login a user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            // Save user info (including role) in the session
            req.session.user = { id: user.id, username: user.username, role: user.role };
            res.json({ message: 'Login successful', user: req.session.user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Logout a user
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
});

// GET: Check authentication status
app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});


// --- Blog Post Routes ---

// GET: Fetch all posts (public)
app.get('/api/posts', async (req, res) => {
    try {
        const [posts] = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Database query failed' });
    }
});

// GET: Fetch a single post by ID (public)
app.get('/api/posts/:id', async (req, res) => {
    // This route is needed for the edit page
    try {
        const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Post not found' });
        }
    } catch (error) { res.status(500).json({ error: 'Database query failed' }); }
});


// POST: Create a new post (Admin only)
app.post('/api/posts', isAdmin, async (req, res) => {
    const { title, content } = req.body;
    try {
        const [result] = await pool.query('INSERT INTO posts (title, content) VALUES (?, ?)', [title, content]);
        res.status(201).json({ id: result.insertId, title, content });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// PUT: Update an existing post (Admin only)
app.put('/api/posts/:id', isAdmin, async (req, res) => {
    const { title, content } = req.body;
    try {
        const [result] = await pool.query('UPDATE posts SET title = ?, content = ? WHERE id = ?', [title, content, req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json({ message: 'Post updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// DELETE: Delete a post (Admin only)
app.delete('/api/posts/:id', isAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM posts WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});


app.listen(PORT, () => {
    console.log(`✨ Server is running `);
});