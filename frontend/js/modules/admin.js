import { api } from '../api.js';
import { state, setState } from '../state.js';
import { showAlert } from '../utils.js';
import { showModal, closeModal } from './ui.js';

// --- Colegios ---
export async function loadColegios() {
    const tbody = document.getElementById('colegiosBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    try {
        const data = await api.colegios.getAll();
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.direccion || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="window.app.editColegio(${c.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteColegio(${c.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
        setState('colegios', data);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
    }
}

export async function saveColegio(id) {
    const nombre = document.getElementById('modalNombre').value;
    const direccion = document.getElementById('modalDireccion').value;
    if (!nombre) { showAlert('Requerido', 'Nombre es obligatorio', 'warning'); return; }
    try {
        if (id && id !== 'null') await api.colegios.update(id, { nombre, direccion });
        else await api.colegios.create({ nombre, direccion });
        closeModal();
        loadColegios();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteColegio(id) {
    if (!confirm('¿Seguro?')) return;
    try {
        await api.colegios.delete(id);
        loadColegios();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export function editColegio(id) {
    const c = state.colegios.find(col => col.id === id);
    if (c) showModal('colegio', c);
}

// --- Cursos ---
export async function loadCursos() {
    const tbody = document.getElementById('cursosBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
    try {
        const data = await api.cursos.getAll();
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nivel?.nombre || '-'}</td>
                <td>${c.letra}</td>
                <td>${c.nivel?.nombre || ''} ${c.letra}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.app.deleteCurso(${c.id})">Eliminar</button></td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
    }
}

export async function saveCurso() {
    const nivel_id = parseInt(document.getElementById('modalNivel').value);
    const letra = document.getElementById('modalLetra').value.toUpperCase();
    if (!nivel_id || !letra) { showAlert('Error', 'Complete los campos', 'warning'); return; }
    try {
        await api.cursos.create({ nivel_id, letra });
        closeModal();
        loadCursos();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteCurso(id) {
    if (!confirm('¿Seguro?')) return;
    try {
        await api.cursos.delete(id);
        loadCursos();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

// --- Asignaturas ---
export async function loadAsignaturas() {
    const tbody = document.getElementById('asignaturasBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    try {
        const data = await api.asignaturas.getAll();
        tbody.innerHTML = data.map(a => `
            <tr>
                <td>${a.id}</td>
                <td>${a.nombre}</td>
                <td><button class="btn btn-danger btn-sm" onclick="window.app.deleteAsignatura(${a.id})">Eliminar</button></td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`;
    }
}

export async function saveAsignatura() {
    const nombre = document.getElementById('modalNombre').value;
    if (!nombre) return;
    try {
        await api.asignaturas.create({ nombre });
        closeModal();
        loadAsignaturas();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteAsignatura(id) {
    if (!confirm('¿Seguro?')) return;
    try {
        await api.asignaturas.delete(id);
        loadAsignaturas();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

// --- Usuarios ---
export async function loadUsuarios() {
    const tbody = document.getElementById('usuariosBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    try {
        const data = await api.auth.getUsers();
        tbody.innerHTML = data.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td><span class="badge ${u.rol_id === 1 ? 'badge-primary' : 'badge-secondary'}">${u.rol?.nombre || '-'}</span></td>
                <td><span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="window.app.editUsuario(${u.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="window.app.deleteUsuario(${u.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
        setState('usuarios', data);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
    }
}

export async function editUsuario(id) {
    const user = state.usuarios.find(u => u.id === id);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPassword').value = ''; // Limpiar campo pass

    // Cargar roles si no están en state
    let roles = state.roles || [];
    if (!roles || roles.length === 0) {
        try {
            console.log("Cargando roles desde API...");
            roles = await api.auth.listRoles();
            setState('roles', roles);
        } catch (error) {
            console.error('Error cargando roles:', error);
            roles = [
                { id: 1, nombre: 'admin' },
                { id: 2, nombre: 'auditor' },
                { id: 3, nombre: 'usuario' }
            ]; // Fallback
        }
    }

    const selRol = document.getElementById('editUserRol');
    if (selRol) {
        console.log("Poblando select de roles con:", roles);
        selRol.innerHTML = roles.map(r => 
            `<option value="${r.id}" ${parseInt(r.id) === parseInt(user.rol_id) ? 'selected' : ''}>${r.nombre}</option>`
        ).join('');
    }

    document.getElementById('modalUsuario').style.display = 'block';
}

export function closeUserModal() {
    document.getElementById('modalUsuario').style.display = 'none';
}

export async function deleteUsuario(id) {
    if (!confirm('¿Seguro que desea eliminar este usuario?')) return;
    try {
        await api.auth.deleteUser(id);
        loadUsuarios();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

// Inicializar form de usuario
document.getElementById('formUsuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const email = document.getElementById('editUserEmail').value;
    const rol_id = parseInt(document.getElementById('editUserRol').value);
    const password = document.getElementById('editUserPassword').value;

    const data = { email, rol_id };
    if (password) data.password = password;

    try {
        await api.auth.updateUser(id, data);
        showAlert('Éxito', 'Usuario actualizado correctamente', 'success');
        closeUserModal();
        loadUsuarios();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
});
