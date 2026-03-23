from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from routers import auth, colegios, niveles, cursos, asignaturas, docentes, dimensiones, evaluaciones, config
from apscheduler.schedulers.background import BackgroundScheduler
from utils.db_utils import generate_sql_dump
from utils.mailer import send_email_with_attachment
from datetime import datetime
import contextlib

Base.metadata.create_all(bind=engine)

# Configuración del Programador de Tareas (Backups)
def scheduled_backup():
    print(f"Ejecutando respaldo programado: {datetime.now()}")
    db = SessionLocal()
    try:
        sql_content = generate_sql_dump(db)
        filename = f"respaldo_auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
        send_email_with_attachment(
            subject="Respaldo Automático Semanal - Liderazgo Docente",
            body=f"Se adjunta el respaldo automático de los viernes. Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}.",
            filename=filename,
            content=sql_content
        )
    except Exception as e:
        print(f"Error en respaldo programado: {str(e)}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
# Cada viernes (fri) a las 18:00 (6:00 PM)
scheduler.add_job(scheduled_backup, 'cron', day_of_week='fri', hour=18, minute=0)
scheduler.start()

app = FastAPI(
    title="API - Pauta de Liderazgo Docente",
    description="Sistema de evaluación de liderazgo docente con FastAPI",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8001",
        "http://localhost:8001"
    ],
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
