from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import io
from datetime import datetime
from database import get_db, engine
from auth import get_current_user, require_admin
from models import Base

from utils.db_utils import generate_sql_dump
from utils.mailer import send_email_with_attachment

router = APIRouter(prefix="/config", tags=["config"])

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
