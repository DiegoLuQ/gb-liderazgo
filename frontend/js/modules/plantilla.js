import { api } from '../api.js';
import { mostrarLoading, showAlert, closeAlert } from '../utils.js';

export async function loadPlantilla() {
    const container = document.getElementById('plantillaContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Cargando plantilla...</div>';
    
    try {
        const dimensiones = await api.dimensiones.getAll();
        renderPlantilla(dimensiones, container);
    } catch (error) {
        console.error('Error cargando plantilla:', error);
        container.innerHTML = `<div class="alert alert-danger">Error al cargar la plantilla: ${error.message}</div>`;
    }
}

function renderPlantilla(dimensiones, container) {
    if (!document.getElementById('plantilla-styles')) {
        const style = document.createElement('style');
        style.id = 'plantilla-styles';
        style.textContent = `
            .dim-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 24px; overflow: hidden; border: 1px solid #eaeaea; transition: transform 0.2s; }
            .dim-header { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to right, #ffffff, #f8f9fa); padding: 20px 24px; border-bottom: 1px solid #eaeaea; }
            .dim-title-group { display: flex; align-items: center; gap: 15px; }
            .drag-handle-dim { color: #b0b5ba; cursor: grab; font-size: 20px; transition: color 0.2s; }
            .drag-handle-dim:hover { color: #002b5e; }
            .dim-name { font-size: 1.25rem; font-weight: 600; color: #1a233a; margin: 0; }
            .dim-actions { display: flex; gap: 10px; }
            .btn-action-dim { padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; }
            .btn-action-dim svg { width: 14px; height: 14px; }
            .btn-action-dim:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
            .btn-edit-dim { color: #004080; border-color: #d0e1f9; background: #f0f6ff; }
            .btn-edit-dim:hover { background: #e0edff; }
            .btn-del-dim { color: #dc3545; border-color: #f8d7da; background: #fff5f6; }
            .btn-del-dim:hover { background: #ffebee; }
            .btn-add-ind { color: #fff; background: #004080; border-color: #004080; }
            .btn-add-ind:hover { background: #002b5e; }
            
            .ind-list { list-style: none; padding: 0; margin: 0; }
            .ind-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #f0f0f0; background: #fff; transition: background 0.2s; }
            .ind-item:last-child { border-bottom: none; }
            .ind-item:hover { background: #fcfcfc; }
            .ind-content { display: flex; align-items: flex-start; gap: 16px; flex: 1; }
            .drag-handle-ind { color: #d0d5da; cursor: grab; padding-top: 2px; }
            .drag-handle-ind:hover { color: #004080; }
            .ind-text { font-size: 0.95rem; color: #444; line-height: 1.5; margin: 0; }
            .ind-actions { display: flex; gap: 6px; opacity: 0.7; transition: opacity 0.2s; }
            .ind-item:hover .ind-actions { opacity: 1; }
            .btn-icon { width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; cursor: pointer; transition: all 0.2s; background: transparent; }
            .btn-icon svg { width: 16px; height: 16px; }
            .btn-icon-edit { color: #004080; }
            .btn-icon-edit:hover { background: #f0f6ff; border-color: #d0e1f9; }
            .btn-icon-del { color: #dc3545; }
            .btn-icon-del:hover { background: #fff5f6; border-color: #f8d7da; }
            .empty-inds { padding: 30px; text-align: center; color: #888; font-style: italic; font-size: 0.95rem; background: #fafafa; }
        `;
        document.head.appendChild(style);
    }

    if (!dimensiones || dimensiones.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align:center; padding: 50px; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">No hay dimensiones configuradas. Haga clic en "Nueva Dimensión" para comenzar.</div>';
        return;
    }

    let html = '';
    dimensiones.sort((a, b) => a.orden - b.orden).forEach(dim => {
        html += `
            <div class="dim-card" data-id="${dim.id}">
                <div class="dim-header">
                    <div class="dim-title-group">
                        <span class="drag-handle-dim">☰</span>
                        <h3 class="dim-name">${dim.nombre}</h3>
                    </div>
                    <div class="dim-actions">
                        <button class="btn-action-dim btn-edit-dim" onclick="window.app.showModalDimension(${dim.id}, \`${dim.nombre}\`)">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                            Editar
                        </button>
                        <button class="btn-action-dim btn-del-dim" onclick="window.app.deleteDimension(${dim.id})">
                            <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                            Eliminar
                        </button>
                        <button class="btn-action-dim btn-add-ind" onclick="window.app.showModalIndicador(${dim.id})">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
                            Nuevo Indicador
                        </button>
                    </div>
                </div>
                <div class="dim-body">
                    <ul class="ind-list" data-dimension-id="${dim.id}">
        `;

        if (dim.subdimensiones && dim.subdimensiones.length > 0) {
            dim.subdimensiones.sort((a, b) => a.orden - b.orden).forEach(sub => {
                html += `
                        <li class="ind-item" data-id="${sub.id}">
                            <div class="ind-content">
                                <span class="drag-handle-ind">⠿</span>
                                <div class="ind-text-group" style="display: flex; flex-direction: column; gap: 4px;">
                                    <p class="ind-title" style="font-weight: 600; font-size: 1rem; color: #2c3e50; margin: 0;">${sub.nombre}</p>
                                    ${sub.descripcion ? `<p class="ind-desc" style="font-size: 0.85rem; color: #6c757d; line-height: 1.4; margin: 0;">${sub.descripcion}</p>` : ''}
                                </div>
                            </div>
                            <div class="ind-actions">
                                <button class="btn-icon btn-icon-edit" onclick='window.app.showModalIndicador(${dim.id}, ${sub.id}, ${JSON.stringify(sub.nombre).replace(/'/g, "\\'")}, ${JSON.stringify(sub.descripcion || "").replace(/'/g, "\\'")})' title="Editar Indicador">
                                    <svg fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                                </button>
                                <button class="btn-icon btn-icon-del" onclick="window.app.deleteIndicador(${sub.id})" title="Eliminar Indicador">
                                    <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                </button>
                            </div>
                        </li>
                `;
            });
        } else {
            html += `<li class="empty-inds">No hay indicadores en esta dimensión. Añade el primero.</li>`;
        }

        html += `
                    </ul>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    if (window.Sortable) {
        new Sortable(container, {
            animation: 150,
            handle: '.drag-handle-dim',
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const dimensionIds = Array.from(container.querySelectorAll('.dim-card')).map(card => parseInt(card.dataset.id));
                try {
                    await api.dimensiones.reorder(dimensionIds);
                } catch (error) {
                    console.error('Error reordenando dimensiones', error);
                    showAlert('Error', 'No se pudo guardar el orden de las dimensiones');
                }
            }
        });

        container.querySelectorAll('.ind-list').forEach(ul => {
            new Sortable(ul, {
                animation: 150,
                handle: '.drag-handle-ind',
                group: 'shared', 
                ghostClass: 'sortable-ghost',
                onEnd: async function (evt) {
                    const dimensionId = parseInt(evt.to.dataset.dimensionId);
                    const indicadorIds = Array.from(evt.to.querySelectorAll('li.ind-item[data-id]')).map(li => parseInt(li.dataset.id));
                    try {
                        await api.dimensiones.reorderIndicadores(indicadorIds);
                    } catch (error) {
                         console.error('Error reordenando indicadores', error);
                         showAlert('Error', 'No se pudo guardar el orden de los indicadores');
                    }
                }
            });
        });
    }
}

export async function showModalDimension(id = null, nombre = '') {
    const isEdit = id !== null;
    const title = isEdit ? 'Editar Dimensión' : 'Nueva Dimensión';
    
    document.getElementById('modalTitle').textContent = title;
    
    const bodyHtml = `
        <div class="form-group">
            <label>Nombre de la Dimensión *</label>
            <input type="text" id="modalDimNombre" value="${nombre}" class="form-control" placeholder="Ej: Liderazgo" required>
        </div>
        <div class="modal-actions" style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="window.app.saveDimension(${id || 'null'})">Guardar Dimensión</button>
        </div>
    `;
    
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
}

export async function saveDimension(id) {
    const nombre = document.getElementById('modalDimNombre').value;
    
    if (!nombre) {
        showAlert('Atención', 'El nombre es requerido');
        return;
    }
    
    try {
        if (id) {
            await api.dimensiones.update(id, { nombre: nombre });
        } else {
            await api.dimensiones.create({ nombre: nombre });
        }
        document.getElementById('modalOverlay').classList.remove('active');
        await loadPlantilla();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteDimension(id) {
    if (!confirm('¿Está seguro de eliminar esta dimensión? Se eliminarán todos sus indicadores irreversiblemente.')) return;
    
    try {
        await api.dimensiones.delete(id);
        await loadPlantilla();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function showModalIndicador(dimensionId, id = null, nombre = '', descripcion = '') {
    const isEdit = id !== null;
    const title = isEdit ? 'Editar Indicador' : 'Nuevo Indicador';
    
    document.getElementById('modalTitle').textContent = title;
    
    const bodyHtml = `
        <input type="hidden" id="modalIndDimId" value="${dimensionId}">
        <div class="form-group" style="margin-bottom: 15px;">
            <label>Nombre del Indicador (Corto) *</label>
            <input type="text" id="modalIndNombre" class="form-control" value="${nombre.replace(/"/g, '&quot;')}" placeholder="Ej: 1. Expresión verbal" required>
        </div>
        <div class="form-group">
            <label>Descripción detallada</label>
            <textarea id="modalIndDesc" class="form-control" rows="3" placeholder="Ej: Comunica con claridad los objetivos...">${descripcion}</textarea>
        </div>
        <div class="modal-actions" style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" onclick="window.app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="window.app.saveIndicador(${id || 'null'})">Guardar Indicador</button>
        </div>
    `;
    
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('active');
}

export async function saveIndicador(id) {
    const dimensionId = parseInt(document.getElementById('modalIndDimId').value);
    const nombre = document.getElementById('modalIndNombre').value;
    const descripcion = document.getElementById('modalIndDesc').value;
    
    if (!nombre) {
        showAlert('Atención', 'El nombre del indicador es requerido');
        return;
    }
    
    try {
        if (id) {
            await api.dimensiones.updateIndicador(id, { nombre: nombre, descripcion: descripcion, dimension_id: dimensionId });
        } else {
            await api.dimensiones.createIndicador(dimensionId, { nombre: nombre, descripcion: descripcion, dimension_id: dimensionId });
        }
        document.getElementById('modalOverlay').classList.remove('active');
        await loadPlantilla();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function deleteIndicador(id) {
    if (!confirm('¿Está seguro de eliminar este indicador?')) return;
    
    try {
        await api.dimensiones.deleteIndicador(id);
        await loadPlantilla();
    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

export async function exportarPlantillaExcel() {
    try {
        await api.dimensiones.exportExcel();
    } catch (error) {
        console.error("Error al exportar plantilla", error);
        showAlert("Error", "No se pudo exportar la plantilla a Excel.");
    }
}
