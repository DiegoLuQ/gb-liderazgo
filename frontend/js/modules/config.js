import { api } from '../api.js';
import { mostrarLoading, showAlert } from '../utils.js';

export async function respaldarManual() {
    try {
        mostrarLoading(true, 'Generando respaldo SQL...');
        const response = await api.config.backup.sql();
        
        if (!response.ok) throw new Error('Error al generar el respaldo');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `respaldo_${new Date().toISOString().slice(0, 10)}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        mostrarLoading(false);
        showAlert('Éxito', 'Respaldo descargado correctamente.', 'success');
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}

export async function enviarRespaldoCorreo() {
    if (!confirm('¿Desea enviar el respaldo por correo ahora?')) return;
    try {
        mostrarLoading(true, 'Enviando respaldo por correo...');
        const res = await api.config.backup.email();
        mostrarLoading(false);
        showAlert('Respaldo', res.message || 'Respaldo enviado con éxito.', 'info');
    } catch (error) {
        mostrarLoading(false);
        showAlert('Error', error.message, 'error');
    }
}
