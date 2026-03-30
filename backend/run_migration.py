import sys
import os
sys.path.append('c:/SISTEMAS-PRUEBA/LIDERAZGO/backend')
from database import engine
from sqlalchemy import text

def run_migration():
    queries = [
        "ALTER TABLE eval_evaluaciones ADD COLUMN fecha_retro DATE",
        "ALTER TABLE eval_evaluaciones ADD COLUMN modalidad_retro VARCHAR(255)",
        "ALTER TABLE eval_evaluaciones ADD COLUMN sintesis_retro TEXT",
        "ALTER TABLE eval_evaluaciones ADD COLUMN acuerdos_mejora TEXT"
    ]
    with engine.connect() as conn:
        print("Conectado.")
        for q in queries:
            try:
                print(f"Ejecutando: {q}")
                conn.execute(text(q))
                conn.commit()
                print("OK.")
            except Exception as e:
                print(f"Información: {e}")

if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"Error fatal: {e}")
