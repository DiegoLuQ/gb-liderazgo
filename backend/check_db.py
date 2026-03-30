import sqlalchemy
from sqlalchemy import create_engine, text

DATABASE_URL = "mysql+pymysql://mcdp_user:mcdp_password@localhost:3306/gb_lider"
engine = create_engine(DATABASE_URL)

def check_eval(eval_id):
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT id, sintesis_retro, acuerdos_mejora, comentarios, estado FROM eval_evaluaciones WHERE id = {eval_id}"))
        row = result.fetchone()
        if row:
            print(f"ID: {row.id}")
            print(f"Sintesis: {row.sintesis_retro}")
            print(f"Acuerdos: {row.acuerdos_mejora}")
            print(f"Comentarios: {row.comentarios}")
            print(f"Estado: {row.estado}")
            
            # Check fortalezas
            fa_result = conn.execute(text(f"SELECT tipo, contenido FROM eval_fortalezas_aspectos WHERE evaluacion_id = {eval_id}"))
            print("Fortalezas/Aspectos:")
            for fa in fa_result:
                print(f"  - {fa.tipo}: {fa.contenido}")
        else:
            print("Evaluación no encontrada")

if __name__ == "__main__":
    check_eval(10)
