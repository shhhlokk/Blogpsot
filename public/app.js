// --- Page Router & Initializer ---
// This function runs when the page is loaded and calls the correct functions based on the URL.
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // A logout button might exist on multiple pages, so we handle it globally if found.
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Page-specific logic router
    if (path.endsWith('/') || path.endsWith('index.html')) {
        renderHomePage();
    } else if (path.endsWith('/register.html')) {
        document.getElementById('register-form').addEventListener('submit', handleRegister);
    } else if (path.endsWith('/login.html')) {
        document.getElementById('login-form').addEventListener('submit', handleLogin);
    } else if (path.endsWith('/admin.html')) {
        renderAdminPage();
    } else if (path.endsWith('/edit.html')) {
        renderEditPage();
    }
});


// --- Authentication Functions ---

/**
 * Handles the user registration form submission.
 */
async function handleRegister(e) {
    e.preventDefault();
    const username = e.target.querySelector('#username').value;
    const password = e.target.querySelector('#password').value;
    const messageEl = document.getElementById('form-message');

    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
        messageEl.className = 'success';
        messageEl.textContent = 'Registration successful! Redirecting to login...';
        setTimeout(() => window.location.href = '/login.html', 2000);
    } else {
        messageEl.className = 'error';
        messageEl.textContent = data.error;
    }
    messageEl.style.display = 'block';
}

/**
 * Handles the user login form submission.
 */
async function handleLogin(e) {
    e.preventDefault();
    const username = e.target.querySelector('#username').value;
    const password = e.target.querySelector('#password').value;
    const messageEl = document.getElementById('form-message');

    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
        // Redirect based on the user's role
        if (data.user.role === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/';
        }
    } else {
        messageEl.className = 'error';
        messageEl.textContent = data.error;
        messageEl.style.display = 'block';
    }
}

/**
 * Handles the logout process.
 */
async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}


// --- Page Rendering Functions ---

/**
 * Fetches data and renders the Home Page (index.html).
 * It dynamically changes the header based on authentication status.
 */
async function renderHomePage() {
    const res = await fetch('/api/auth/status');
    const authStatus = await res.json();
    const postsContainer = document.getElementById('posts-container');
    const headerControls = document.getElementById('header-controls');
    const createPostLink = document.getElementById('create-post-link');

    // Update header UI based on login status
    if (authStatus.loggedIn) {
        let adminLink = '';
        if (authStatus.user.role === 'admin') {
            adminLink = `<a href="/admin.html" class="home-btn">Admin Panel</a>`;
            // Show the "Create New Post" button for admins
            if(createPostLink) createPostLink.style.display = 'inline-block';
        }
        headerControls.innerHTML = `
            <span>Welcome, ${authStatus.user.username}</span>
            ${adminLink}
            <button id="logout-btn-dynamic" class="logout-btn">Logout</button>
        `;
        document.getElementById('logout-btn-dynamic').addEventListener('click', handleLogout);
    } else {
        headerControls.innerHTML = `
            <a href="/login.html" class="home-btn">Login</a>
            <a href="/register.html" class="create-post-btn">Register</a>
        `;
    }

    // Fetch and display all blog posts
    const postsRes = await fetch('/api/posts');
    const posts = await postsRes.json();
    postsContainer.innerHTML = '';
    posts.forEach(post => {
        const postEl = document.createElement('article');
        postEl.className = 'post';
        postEl.innerHTML = `
            <h2>${post.title}</h2>
            <p class="post-meta">Posted on ${new Date(post.created_at).toLocaleDateString()}</p>
            <p>${post.content}</p>
        `;
        postsContainer.appendChild(postEl);
    });
}

/**
 * Fetches data and renders the Admin Panel (admin.html).
 * This includes security checks, post creation, and the list of posts to manage.
 */
async function renderAdminPage() {
    // Security Check: Kick out non-admins
    const res = await fetch('/api/auth/status');
    const authStatus = await res.json();
    if (!authStatus.loggedIn || authStatus.user.role !== 'admin') {
        window.location.href = '/login.html';
        return;
    }

    // Handle the "Create Post" form submission
    document.getElementById('create-post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('create-title').value;
        const content = document.getElementById('create-content').value;
        
        await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content }),
        });
        
        e.target.reset();
        loadManageablePosts(); // Refresh the list of posts after creating a new one
    });

    // Function to load and display all posts with Edit/Delete buttons
    const postsListContainer = document.getElementById('manage-posts-list');
    async function loadManageablePosts() {
        const postsRes = await fetch('/api/posts');
        const posts = await postsRes.json();
        postsListContainer.innerHTML = '';
        posts.forEach(post => {
            const postItem = document.createElement('div');
            postItem.className = 'manage-post-item';
            postItem.innerHTML = `
                <h3>${post.title}</h3>
                <div>
                    <a href="/edit.html?id=${post.id}" class="btn-edit">Edit</a>
                    <button class="btn-delete" data-id="${post.id}">Delete</button>
                </div>
            `;
            postsListContainer.appendChild(postItem);
        });

        // Add event listeners to all newly created "Delete" buttons
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this post?')) {
                    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
                    loadManageablePosts(); // Refresh the list after deletion
                }
            });
        });
    }

    loadManageablePosts(); // Initial load of posts
}

/**
 * Fetches a single post's data and renders the Edit Page (edit.html).
 */
async function renderEditPage() {
    // Security Check: Kick out non-admins
    const authRes = await fetch('/api/auth/status');
    const authStatus = await authRes.json();
    if (!authStatus.loggedIn || authStatus.user.role !== 'admin') {
        window.location.href = '/login.html';
        return;
    }

    const postId = new URLSearchParams(window.location.search).get('id');
    const form = document.getElementById('edit-post-form');
    
    // Fetch the specific post's data
    const postRes = await fetch(`/api/posts/${postId}`);
    const post = await postRes.json();
    
    // Populate the form fields with the existing data
    document.getElementById('edit-post-id').value = post.id;
    document.getElementById('edit-title').value = post.title;
    document.getElementById('edit-content').value = post.content;

    // Handle the "Save Changes" form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-post-id').value;
        const title = document.getElementById('edit-title').value;
        const content = document.getElementById('edit-content').value;

        const response = await fetch(`/api/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content }),
        });

        if (response.ok) {
            window.location.href = '/admin.html'; // Redirect back to the admin panel
        } else {
            alert('Failed to update post.');
        }
    });
}
