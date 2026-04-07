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

def scheduled_weekly_report():
    print(f"Generando reporte semanal programado: {datetime.now()}")
    db = SessionLocal()
    try:
        from models import Evaluacion, EvaluacionEstado, Colegio
        from utils.email import send_evaluation_email
        from utils.report_templates import generate_weekly_report_html
        import os

        # 1. Obtener todos los colegios
        colegios = db.query(Colegio).all()
        
        # 2. Estructura de datos
        data = {
            "GLOBAL": {
                "BORRADOR": db.query(Evaluacion).filter(Evaluacion.estado == EvaluacionEstado.BORRADOR).count(),
                "CERRADA": db.query(Evaluacion).filter(Evaluacion.estado == EvaluacionEstado.CERRADA).count(),
                "LISTO_PARA_FIRMA": db.query(Evaluacion).filter(Evaluacion.estado == EvaluacionEstado.LISTO_PARA_FIRMA).count(),
            },
            "SCHOOLS": {}
        }
        data["GLOBAL"]["TOTAL"] = sum(data["GLOBAL"].values())

        # 3. Conteos por colegio
        for col in colegios:
            c_borrador = db.query(Evaluacion).join(Evaluacion.docente).filter(
                Evaluacion.estado == EvaluacionEstado.BORRADOR,
                Evaluacion.docente.has(colegio_id=col.id)
            ).count()
            c_cerrada = db.query(Evaluacion).join(Evaluacion.docente).filter(
                Evaluacion.estado == EvaluacionEstado.CERRADA,
                Evaluacion.docente.has(colegio_id=col.id)
            ).count()
            c_listo = db.query(Evaluacion).join(Evaluacion.docente).filter(
                Evaluacion.estado == EvaluacionEstado.LISTO_PARA_FIRMA,
                Evaluacion.docente.has(colegio_id=col.id)
            ).count()
            
            data["SCHOOLS"][col.nombre] = {
                "BORRADOR": c_borrador,
                "CERRADA": c_cerrada,
                "LISTO_PARA_FIRMA": c_listo,
                "TOTAL": c_borrador + c_cerrada + c_listo
            }

        # 4. Obtener últimos borradores (top 5 global)
        latest_drafts_db = db.query(Evaluacion).filter(
            Evaluacion.estado == EvaluacionEstado.BORRADOR
        ).order_by(Evaluacion.fecha.desc()).limit(5).all()

        latest_drafts = []
        for d in latest_drafts_db:
            latest_drafts.append({
                "id": d.id,
                "docente": d.docente.nombre if d.docente else "N/A",
                "curso": f"{d.curso.nivel.nombre} {d.curso.letra}" if d.curso and d.curso.nivel else "N/A",
                "fecha": d.fecha.strftime("%d/%m/%Y") if d.fecha else "N/A"
            })

        # 5. Generar HTML
        html_content = generate_weekly_report_html(data, latest_drafts)

        # 6. Destinatarios desde .env
        to_email = os.getenv("REPORT_TO_EMAIL")
        cc_emails_str = os.getenv("REPORT_CC_EMAILS", "")
        cc_emails = [e.strip() for e in cc_emails_str.split(",") if e.strip()]

        if not to_email:
            print("Error: No se ha configurado REPORT_TO_EMAIL en el .env")
            return

        # 7. Enviar correo
        send_evaluation_email(
            to_emails=[to_email],
            cc_emails=cc_emails,
            subject="Resumen Semanal de Acompañamiento Liderazgo",
            body="Resumen semanal de gestión pedagógica por colegio.",
            body_html=html_content,
            school_type="MC"
        )
        print(f"Reporte semanal enviado a {to_email} con CC a {cc_emails}")
    except Exception as e:
        print(f"Error en reporte semanal programado: {str(e)}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
# Cada viernes (fri) a las 18:00 (6:00 PM)
scheduler.add_job(scheduled_backup, 'cron', day_of_week='fri', hour=18, minute=0)
# Cada lunes (mon) a las 09:00 AM
scheduler.add_job(scheduled_weekly_report, 'cron', day_of_week='mon', hour=8, minute=45)
scheduler.start()

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
