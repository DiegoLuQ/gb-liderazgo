from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import io
import os
from datetime import datetime
from database import get_db, engine
from auth import get_current_user, require_admin
from models import Base, EmailRecipient

from utils.db_utils import generate_sql_dump
from utils.mailer import send_email_with_attachment

router = APIRouter(prefix="/config", tags=["config"])

@router.get("/info")
def get_config_info():
    return {
        "BASE_URL": os.getenv("BASE_URL", "http://127.0.0.1:5500/frontend")
    }

@router.get("/backup/sql")
async def get_backup_sql(
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    try:
        sql_content = generate_sql_dump(db)
        return PlainTextResponse(
            content=sql_content,
            headers={
                "Content-Disposition": f"attachment; filename=respaldo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando respaldo: {str(e)}")

@router.post("/backup/email")
async def send_backup_email(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin_user = Depends(require_admin)
):
    sql_content = generate_sql_dump(db)
    filename = f"respaldo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    
    background_tasks.add_task(
        send_email_with_attachment,
        subject="Respaldo Manual - Pauta Liderazgo Docente",
        body=f"Se adjunta el respaldo manual de la base de datos generado el {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}.",
        filename=filename,
        content=sql_content
    )
    
    return {"message": "El respaldo se está procesando y será enviado a su correo en unos instantes."}

# CRUD para destinatarios de correo adicionales
@router.get("/email-recipients")
def get_email_recipients(db: Session = Depends(get_db), admin_user = Depends(require_admin)):
    from models import Colegio
    recipients = db.query(EmailRecipient).outerjoin(Colegio).all()
    # Mapear para incluir el nombre del colegio
    result = []
    for r in recipients:
        result.append({
            "id": r.id,
            "email": r.email,
            "nombre": r.nombre,
            "colegio_id": r.colegio_id,
            "colegio_nombre": r.colegio.nombre if r.colegio else "Todos los colegios",
            "activo": r.activo
        })
    return result

@router.post("/email-recipients")
def create_email_recipient(data: dict, db: Session = Depends(get_db), admin_user = Depends(require_admin)):
    new_recipient = EmailRecipient(
        email=data.get("email"),
        nombre=data.get("nombre"),
        colegio_id=data.get("colegio_id") if data.get("colegio_id") else None,
        activo=data.get("activo", True)
    )
    db.add(new_recipient)
    db.commit()
    db.refresh(new_recipient)
    return new_recipient

@router.delete("/email-recipients/{id}")
def delete_email_recipient(id: int, db: Session = Depends(get_db), admin_user = Depends(require_admin)):
    recipient = db.query(EmailRecipient).filter(EmailRecipient.id == id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    db.delete(recipient)
    db.commit()
    return {"message": "Destinatario eliminado"}
