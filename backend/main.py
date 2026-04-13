from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from routers import auth, colegios, niveles, cursos, asignaturas, docentes, dimensiones, evaluaciones, config, totp
from apscheduler.schedulers.background import BackgroundScheduler
from utils.db_utils import generate_sql_dump
from utils.mailer import send_email_with_attachment
from utils.websocket_manager import manager
from datetime import datetime
import contextlib

Base.metadata.create_all(bind=engine)


# ============================================================
# Auto-Migración: Tokens UUID para Actas Seguras
# Se ejecuta al arrancar el servidor (seguro para re-ejecuciones)
# ============================================================
def auto_migrate_tokens():
    """Agrega columnas token_full y token_pedagogico si no existen,
    y genera UUIDs para evaluaciones que no los tengan."""
    import uuid
    from sqlalchemy import text, inspect
    from models import Evaluacion
    
    try:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('eval_evaluaciones')]
        
        if 'token_full' not in columns or 'token_pedagogico' not in columns:
            print("[MIGRACIÓN] Agregando columnas de tokens UUID...")
            with engine.connect() as conn:
                if 'token_full' not in columns:
                    conn.execute(text("ALTER TABLE eval_evaluaciones ADD COLUMN token_full VARCHAR(50) NULL"))
                    conn.execute(text("CREATE INDEX idx_token_full ON eval_evaluaciones(token_full)"))
                if 'token_pedagogico' not in columns:
                    conn.execute(text("ALTER TABLE eval_evaluaciones ADD COLUMN token_pedagogico VARCHAR(50) NULL"))
                    conn.execute(text("CREATE INDEX idx_token_pedagogico ON eval_evaluaciones(token_pedagogico)"))
                conn.commit()
            print("[MIGRACIÓN] Columnas creadas exitosamente.")
        
        # Poblar evaluaciones sin tokens
        db = SessionLocal()
        sin_token = db.query(Evaluacion).filter(
            (Evaluacion.token_full == None) | (Evaluacion.token_pedagogico == None)
        ).all()
        
        if sin_token:
            print(f"[MIGRACIÓN] Generando UUIDs para {len(sin_token)} evaluaciones...")
            for ev in sin_token:
                if not ev.token_full:
                    ev.token_full = str(uuid.uuid4())
                if not ev.token_pedagogico:
                    ev.token_pedagogico = str(uuid.uuid4())
            db.commit()
            print("[MIGRACIÓN] UUIDs generados exitosamente.")
        
        db.close()
    except Exception as e:
        print(f"[MIGRACIÓN] Advertencia (no crítica): {e}")

def auto_migrate_reporting():
    """Migración para la tabla de destinatarios y el historial de reportes."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)
        
        # 1. Crear tabla de historial si no existe (SQLAlchemy lo hace por nosotros con create_all, pero por seguridad)
        Base.metadata.create_all(bind=engine)
        
        # 2. Agregar columna recibe_reporte si no existe
        columns = [col['name'] for col in inspector.get_columns('cfg_email_recipients')]
        if 'recibe_reporte' not in columns:
            print("[MIGRACIÓN] Agregando columna recibe_reporte...")
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE cfg_email_recipients ADD COLUMN recibe_reporte BOOLEAN DEFAULT FALSE"))
                conn.commit()
            print("[MIGRACIÓN] Columna agregada.")
            
    except Exception as e:
        print(f"[MIGRACIÓN REPORTES] Advertencia: {e}")

auto_migrate_tokens()
auto_migrate_reporting()


from utils.tasks import scheduled_backup, scheduled_weekly_report
import pytz
chile_tz = pytz.timezone('America/Santiago')

scheduler = BackgroundScheduler()
# Cada viernes (fri) a las 18:00 (6:00 PM) Chile
scheduler.add_job(scheduled_backup, 'cron', day_of_week='fri', hour=18, minute=0, timezone=chile_tz)
# Cada lunes (mon) a las 16:00 (4:00 PM) Chile
scheduler.add_job(scheduled_weekly_report, 'cron', day_of_week='mon', hour=16, minute=0, timezone=chile_tz)
scheduler.start()

print(f"[SISTEMA] Tareas automáticas reactivadas (Chile Time). Reporte: Lunes 16:00, Respaldo: Viernes 18:00")

app = FastAPI(
    title="API - Pauta de Liderazgo Docente",
    description="Sistema de evaluación de liderazgo docente con FastAPI",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(colegios.router)
app.include_router(niveles.router)
app.include_router(cursos.router)
app.include_router(asignaturas.router)
app.include_router(docentes.router)
app.include_router(dimensiones.router)
app.include_router(evaluaciones.router)
app.include_router(config.router)
app.include_router(totp.router)


@app.websocket("/ws/evaluacion/{eval_id}")
async def websocket_endpoint(websocket: WebSocket, eval_id: int):
    await manager.connect(eval_id, websocket)
    try:
        while True:
            # Mantener conexión abierta
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(eval_id, websocket)


@app.get("/")
def root():
    return {
        "message": "API Pauta de Liderazgo Docente",
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
