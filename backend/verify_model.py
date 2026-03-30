from sqlalchemy.orm import Session
from database import SessionLocal
from models import Evaluacion, EvaluacionEstado
import secrets
from datetime import datetime

db = SessionLocal()
try:
    # Check if Evaluacion has the attribute
    print(f"Has codigo_firma: {hasattr(Evaluacion, 'codigo_firma')}")
    print(f"Has fecha_firma_docente: {hasattr(Evaluacion, 'fecha_firma_docente')}")
    
    # Try to fetch id=6 and see if we can set it
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == 6).first()
    if evaluacion:
        print(f"Existing estado: {evaluacion.estado}")
        evaluacion.codigo_firma = f"TEST-{secrets.token_hex(2).upper()}"
        evaluacion.fecha_firma_docente = datetime.now()
        db.commit()
        print("Commit successful")
        
        # Verify
        db.refresh(evaluacion)
        print(f"Stored codigo_firma: {evaluacion.codigo_firma}")
    else:
        print("Eval 6 not found")
finally:
    db.close()
