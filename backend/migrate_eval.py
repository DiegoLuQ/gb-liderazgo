from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Obteniendo información de la tabla...")
        res = conn.execute(text("SHOW CREATE TABLE eval_evaluaciones"))
        create_sql = res.fetchone()[1]
        print(create_sql)
        
        # Buscar el nombre de la FK que apunta a cat_observadores
        import re
        match = re.search(r'CONSTRAINT `(\w+)` FOREIGN KEY \(`observador_id`\) REFERENCES `cat_observadores` \(`id`\)', create_sql)
        if match:
            fk_name = match.group(1)
            print(f"Eliminando clave foránea: {fk_name}")
            conn.execute(text(f"ALTER TABLE eval_evaluaciones DROP FOREIGN KEY {fk_name}"))
        else:
            print("No se encontró la clave foránea para observador_id, procediendo...")

        print("Modificando columna observador_id...")
        # Hacerla nullable primero para evitar errores si hay datos
        conn.execute(text("ALTER TABLE eval_evaluaciones MODIFY observador_id INT NULL"))
        
        print("Añadiendo nueva clave foránea a auth_usuarios...")
        conn.execute(text("ALTER TABLE eval_evaluaciones ADD CONSTRAINT fk_eval_observador_usuario FOREIGN KEY (observador_id) REFERENCES auth_usuarios(id)"))
        
        # Actualizar datos existentes: si observador_id es de cat_observadores, 
        # intentar mapear a través de usuario_id si es posible, o dejarlo como está si el ID coincide (poco probable)
        # Pero como el usuario dice 'EL OBSERVADOR SIEMPRE SERA EL LOGUEADO', 
        # podemos setear observador_id = usuario_id para todas las existentes.
        print("Sincronizando observador_id con usuario_id en registros existentes...")
        conn.execute(text("UPDATE eval_evaluaciones SET observador_id = usuario_id"))
        
        conn.commit()
        print("Migración completada con éxito.")

if __name__ == "__main__":
    migrate()
