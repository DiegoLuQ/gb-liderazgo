const API_URL = window.location.port === '8080' || window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? '/api' 
    : 'http://localhost:8001';

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const authMessage = document.getElementById('authMessage');

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
        authMessage.textContent = '';
        authMessage.className = 'message';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
        authMessage.textContent = '';
        authMessage.className = 'message';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Usuario o contraseña incorrectos');
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('username', username);
            window.location.href = 'dashboard.html';
        } catch (error) {
            authMessage.textContent = error.message;
            authMessage.className = 'message error';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail')?.value || `${username}@example.com`;
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (password !== passwordConfirm) {
            authMessage.textContent = 'Las contraseñas no coinciden';
            authMessage.className = 'message error';
            return;
        }

        if (password.length < 4) {
            authMessage.textContent = 'La contraseña debe tener al menos 4 caracteres';
            authMessage.className = 'message error';
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al crear cuenta');
            }

            authMessage.textContent = '¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.';
            authMessage.className = 'message success';
            
            setTimeout(() => {
                loginSection.style.display = 'block';
                registerSection.style.display = 'none';
                document.getElementById('username').value = username;
                document.getElementById('password').value = '';
            }, 1500);
        } catch (error) {
            authMessage.textContent = error.message;
            authMessage.className = 'message error';
        }
    });
});
