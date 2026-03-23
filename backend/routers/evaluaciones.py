from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import pandas as pd
import io
from datetime import datetime, date

from database import get_db
from models import Evaluacion, EvaluacionRespuesta, EvaluacionApoyo, FortalezaAspecto, Usuario, Curso, Docente, Asignatura
from schemas import EvaluacionCreate, EvaluacionResponse, EvaluacionListResponse
from auth import get_current_active_user, require_admin_or_auditor

router = APIRouter(prefix="/evaluaciones", tags=["Evaluaciones"])


def build_evaluacion_response(evaluacion: Evaluacion) -> dict:
    return {
        "id": evaluacion.id,
        "usuario_id": evaluacion.usuario_id,
        "docente_id": evaluacion.docente_id,
        "curso_id": evaluacion.curso_id,
        "asignatura_id": evaluacion.asignatura_id,
        "observador_id": evaluacion.observador_id,
        "fecha": evaluacion.fecha,
        "duracion": evaluacion.duracion,
        "func_grupo": evaluacion.func_grupo,
        "promedio": evaluacion.promedio,
        "promedio_dim1": evaluacion.promedio_dim1,
        "promedio_dim2": evaluacion.promedio_dim2,
        "promedio_dim3": evaluacion.promedio_dim3,
        "promedio_dim4": evaluacion.promedio_dim4,
        "promedio_dim5": evaluacion.promedio_dim5,
        "orientacion": evaluacion.orientacion,
        "nivel_apoyo": evaluacion.nivel_apoyo,
        "comentarios": evaluacion.comentarios,
        "fecha_guardado": evaluacion.fecha_guardado,
        "docente": {
            "id": evaluacion.docente.id,
            "nombre": evaluacion.docente.nombre,
            "rut": evaluacion.docente.rut,
            "email": evaluacion.docente.email,
            "colegio_id": evaluacion.docente.colegio_id,
            "created_by": evaluacion.docente.created_by,
            "created_at": evaluacion.docente.created_at,
            "colegio": {
                "id": evaluacion.docente.colegio.id,
                "nombre": evaluacion.docente.colegio.nombre,
                "direccion": evaluacion.docente.colegio.direccion,
                "created_by": evaluacion.docente.colegio.created_by,
                "created_at": evaluacion.docente.colegio.created_at
            } if evaluacion.docente.colegio else None
        } if evaluacion.docente else None,
        "curso": {
            "id": evaluacion.curso.id,
            "nivel_id": evaluacion.curso.nivel_id,
            "letra": evaluacion.curso.letra,
            "nivel": {
                "id": evaluacion.curso.nivel.id,
                "nombre": evaluacion.curso.nivel.nombre,
                "orden": evaluacion.curso.nivel.orden
            } if evaluacion.curso.nivel else None,
            "created_by": evaluacion.curso.created_by,
            "created_at": evaluacion.curso.created_at
        } if evaluacion.curso else None,
        "asignatura": {
            "id": evaluacion.asignatura.id,
            "nombre": evaluacion.asignatura.nombre,
            "created_by": evaluacion.asignatura.created_by,
            "created_at": evaluacion.asignatura.created_at
        } if evaluacion.asignatura else None,
        "observador": {
            "id": evaluacion.observador.id,
            "username": evaluacion.observador.username,
            "email": evaluacion.observador.email,
            "rol_id": evaluacion.observador.rol_id,
            "activo": evaluacion.observador.activo,
            "created_at": evaluacion.observador.created_at
        } if evaluacion.observador else None,
        "respuestas": [
            {
                "id": r.id,
                "subdimension_id": r.subdimension_id,
                "valor": r.valor
            }
            for r in evaluacion.respuestas
        ],
        "apoyos": [
            {
                "id": a.id,
                "apoyo": a.apoyo
            }
            for a in evaluacion.apoyos
        ],
        "fortalezas_aspectos": [
            {
                "id": fa.id,
                "tipo": fa.tipo,
                "contenido": fa.contenido
            }
            for fa in evaluacion.fortalezas_aspectos
        ]
    }


@router.post("/", response_model=EvaluacionResponse)
def crear_evaluacion(
    evaluacion_data: EvaluacionCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    if current_user.rol_id == 2:
        raise HTTPException(status_code=403, detail="Los auditores no pueden crear evaluaciones")

    new_eval = Evaluacion(
        usuario_id=current_user.id,
        docente_id=evaluacion_data.docente_id,
        curso_id=evaluacion_data.curso_id,
        asignatura_id=evaluacion_data.asignatura_id,
        observador_id=current_user.id, # El observador SIEMPRE es el usuario logueado
        fecha=evaluacion_data.fecha,
        duracion=evaluacion_data.duracion,
        func_grupo=evaluacion_data.func_grupo,
        promedio=evaluacion_data.promedio,
        promedio_dim1=evaluacion_data.promedio_dim1,
        promedio_dim2=evaluacion_data.promedio_dim2,
        promedio_dim3=evaluacion_data.promedio_dim3,
        promedio_dim4=evaluacion_data.promedio_dim4,
        promedio_dim5=evaluacion_data.promedio_dim5,
        orientacion=evaluacion_data.orientacion,
        nivel_apoyo=evaluacion_data.nivel_apoyo,
        comentarios=evaluacion_data.comentarios
    )
    db.add(new_eval)
    db.flush()

    for resp in evaluacion_data.respuestas:
        db_resp = EvaluacionRespuesta(
            evaluacion_id=new_eval.id,
            subdimension_id=resp.subdimension_id,
            valor=resp.valor
        )
        db.add(db_resp)

    for apoyo in evaluacion_data.apoyos:
        db_apoyo = EvaluacionApoyo(
            evaluacion_id=new_eval.id,
            apoyo=apoyo.apoyo
        )
        db.add(db_apoyo)

    for fa in evaluacion_data.fortalezas_aspectos:
        db_fa = FortalezaAspecto(
            evaluacion_id=new_eval.id,
            tipo=fa.tipo,
            contenido=fa.contenido
        )
        db.add(db_fa)

    db.commit()
    db.refresh(new_eval)

    return build_evaluacion_response(new_eval)


@router.get("/", response_model=List[EvaluacionListResponse])
def listar_evaluaciones(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion).options(
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura),
        joinedload(Evaluacion.observador)
    )

    if current_user.rol_id == 3:
        query = query.filter(Evaluacion.usuario_id == current_user.id)

    query = query.order_by(Evaluacion.fecha_guardado.desc())
    evaluaciones = query.all()

    result = []
    for e in evaluaciones:
        result.append({
            "id": e.id,
            "fecha": e.fecha,
            "promedio": e.promedio,
            "func_grupo": e.func_grupo,
            "docente_id": e.docente_id,
            "docente_nombre": e.docente.nombre if e.docente else None,
            "colegio_id": e.docente.colegio_id if e.docente else None,
            "colegio_nombre": e.docente.colegio.nombre if e.docente and e.docente.colegio else None,
            "curso_nombre": f"{e.curso.nivel.nombre} {e.curso.letra}" if e.curso and e.curso.nivel else None,
            "asignatura_nombre": e.asignatura.nombre if e.asignatura else None,
            "observador_nombre": e.observador.username if e.observador else None,
            "fecha_guardado": e.fecha_guardado
        })
    return result


@router.get("/export/excel")
def exportar_excel(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion).options(
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura),
        joinedload(Evaluacion.observador),
        joinedload(Evaluacion.respuestas),
        joinedload(Evaluacion.fortalezas_aspectos)
    )

    if current_user.rol_id == 3:
        query = query.filter(Evaluacion.usuario_id == current_user.id)

    evaluaciones = query.all()

    if not evaluaciones:
        raise HTTPException(status_code=404, detail="No hay evaluaciones para exportar")

    data = []
    for e in evaluaciones:
        fortalezas = [fa.contenido for fa in e.fortalezas_aspectos if fa.tipo == "fortaleza"]
        aspectos = [fa.contenido for fa in e.fortalezas_aspectos if fa.tipo == "aspecto"]

        row = {
            "ID": e.id,
            "Colegio": e.docente.colegio.nombre if e.docente and e.docente.colegio else "",
            "Docente": e.docente.nombre if e.docente else "",
            "RUT Docente": e.docente.rut if e.docente else "",
            "Curso": f"{e.curso.nivel.nombre} {e.curso.letra}" if e.curso and e.curso.nivel else "",
            "Asignatura": e.asignatura.nombre if e.asignatura else "",
            "Fecha Observación": e.fecha,
            "Observador": e.observador.username if e.observador else "",
            "Duración": e.duracion or "",
            "Promedio": e.promedio,
            "Funcionamiento Grupo": e.func_grupo,
            "Orientación": e.orientacion,
            "Nivel de Apoyo": e.nivel_apoyo,
            "Fortalezas": "; ".join(fortalezas),
            "Aspectos a Fortalecer": "; ".join(aspectos),
            "Comentarios": e.comentarios or "",
            "Fecha Guardado": e.fecha_guardado
        }

        for i in range(1, 16):
            row[f"Ind {i}"] = ""

        for resp in e.respuestas:
            if 1 <= resp.subdimension_id <= 15:
                row[f"Ind {resp.subdimension_id}"] = resp.valor

        data.append(row)

    df = pd.DataFrame(data)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Evaluaciones")

        worksheet = writer.sheets["Evaluaciones"]
        for idx in range(len(df.columns)):
            col_letter = chr(65 + idx) if idx < 26 else 'A' + chr(65 + idx - 26)
            max_length = max(df.iloc[:, idx].astype(str).map(len).max(), len(df.columns[idx])) + 2
            worksheet.column_dimensions[col_letter].width = min(max_length, 50)

    output.seek(0)
    filename = f"evaluaciones_liderazgo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/stats/dashboard")
def dashboard_stats(
    colegio_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_or_auditor)
):
    query = db.query(Evaluacion)
    
    if colegio_id:
        query = query.join(Docente).filter(Docente.colegio_id == colegio_id)

    if current_user.rol_id == 2:
        query = query.filter(Evaluacion.usuario_id == current_user.id)

    total = query.count()

    prom_query = db.query(func.avg(Evaluacion.promedio))
    if colegio_id:
        prom_query = prom_query.join(Docente).filter(Docente.colegio_id == colegio_id)
    if current_user.rol_id == 2:
        prom_query = prom_query.filter(Evaluacion.usuario_id == current_user.id)
    promedio_general = prom_query.scalar() or 0

    doc_query = db.query(func.count(func.distinct(Evaluacion.docente_id)))
    if colegio_id:
        doc_query = doc_query.join(Docente).filter(Docente.colegio_id == colegio_id)
    if current_user.rol_id == 2:
        doc_query = doc_query.filter(Evaluacion.usuario_id == current_user.id)
    total_docentes = doc_query.scalar() or 0

    return {
        "total_evaluaciones": total,
        "promedio_general": round(promedio_general, 2),
        "total_docentes_evaluados": total_docentes
    }


@router.get("/stats")
def get_stats(
    colegio_id: Optional[int] = Query(None),
    asignatura_id: Optional[int] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion).join(Docente).options(
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura)
    )
    
    if colegio_id:
        query = query.filter(Docente.colegio_id == colegio_id)
    if asignatura_id:
        query = query.filter(Evaluacion.asignatura_id == asignatura_id)
    if fecha_inicio:
        try:
            start_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
            query = query.filter(Evaluacion.fecha >= start_dt)
        except ValueError:
            pass
    if fecha_fin:
        try:
            end_dt = datetime.strptime(fecha_fin, '%Y-%m-%d')
            query = query.filter(Evaluacion.fecha <= end_dt)
        except ValueError:
            pass
            
    evaluaciones = query.all()
    
    if not evaluaciones:
        return {
            "total_evaluaciones": 0,
            "promedio_global": 0,
            "promedios_dimensiones": [0, 0, 0, 0, 0],
            "distribucion_niveles": {"Bajo": 0, "En desarrollo": 0, "Adecuado": 0, "Alto": 0, "Muy alto": 0},
            "por_asignatura": {},
            "por_colegio": {},
            "por_curso": {},
            "dimensiones_por_colegio": {}
        }
        
    total = len(evaluaciones)
    promedio_global = sum(e.promedio for e in evaluaciones) / total
    
    dim_sums = [0.0] * 5
    dim_counts = [0] * 5
    for e in evaluaciones:
        if e.promedio_dim1 is not None: dim_sums[0] += e.promedio_dim1; dim_counts[0] += 1
        if e.promedio_dim2 is not None: dim_sums[1] += e.promedio_dim2; dim_counts[1] += 1
        if e.promedio_dim3 is not None: dim_sums[2] += e.promedio_dim3; dim_counts[2] += 1
        if e.promedio_dim4 is not None: dim_sums[3] += e.promedio_dim4; dim_counts[3] += 1
        if e.promedio_dim5 is not None: dim_sums[4] += e.promedio_dim5; dim_counts[4] += 1
        
    promedios_dims = [ round(dim_sums[i] / dim_counts[i], 2) if dim_counts[i] > 0 else 0 for i in range(5) ]
    
    niveles = {"Bajo": 0, "En desarrollo": 0, "Adecuado": 0, "Alto": 0, "Muy alto": 0}
    for e in evaluaciones:
        p = e.promedio
        if p < 2.0: niveles["Bajo"] += 1
        elif p < 3.0: niveles["En desarrollo"] += 1
        elif p < 4.0: niveles["Adecuado"] += 1
        elif p < 4.5: niveles["Alto"] += 1
        else: niveles["Muy alto"] += 1
        
    asig_stats = {}
    for e in evaluaciones:
        asig_name = e.asignatura.nombre if e.asignatura else "Sin asignatura"
        if asig_name not in asig_stats:
            asig_stats[asig_name] = {"suma": 0, "cuenta": 0}
        asig_stats[asig_name]["suma"] += e.promedio
        asig_stats[asig_name]["cuenta"] += 1
    
    por_asignatura = {name: round(s["suma"]/s["cuenta"], 2) for name, s in asig_stats.items()}

    col_stats = {}
    for e in evaluaciones:
        col_name = e.docente.colegio.nombre if e.docente and e.docente.colegio else "Sin colegio"
        if col_name not in col_stats:
            col_stats[col_name] = {"suma": 0, "cuenta": 0}
        col_stats[col_name]["suma"] += e.promedio
        col_stats[col_name]["cuenta"] += 1
    
    por_colegio = {name: round(s["suma"]/s["cuenta"], 2) for name, s in col_stats.items()}

    # Agregación por Curso (Promedio Global)
    curso_stats = {}
    for e in evaluaciones:
        curso_name = f"{e.curso.nivel.nombre} {e.curso.letra}" if e.curso and e.curso.nivel else "Sin curso"
        if curso_name not in curso_stats:
            curso_stats[curso_name] = {"suma": 0, "cuenta": 0}
        curso_stats[curso_name]["suma"] += e.promedio
        curso_stats[curso_name]["cuenta"] += 1
    
    por_curso = {name: round(s["suma"]/s["cuenta"], 2) for name, s in curso_stats.items()}

    # Promedios por Dimensión per Curso (NUEVO)
    dims_curso_stats = {}
    for e in evaluaciones:
        curso_name = f"{e.curso.nivel.nombre} {e.curso.letra}" if e.curso and e.curso.nivel else "Sin curso"
        if curso_name not in dims_curso_stats:
            dims_curso_stats[curso_name] = [{"suma": 0.0, "cuenta": 0} for _ in range(5)]
        
        if e.promedio_dim1 is not None: dims_curso_stats[curso_name][0]["suma"] += e.promedio_dim1; dims_curso_stats[curso_name][0]["cuenta"] += 1
        if e.promedio_dim2 is not None: dims_curso_stats[curso_name][1]["suma"] += e.promedio_dim2; dims_curso_stats[curso_name][1]["cuenta"] += 1
        if e.promedio_dim3 is not None: dims_curso_stats[curso_name][2]["suma"] += e.promedio_dim3; dims_curso_stats[curso_name][2]["cuenta"] += 1
        if e.promedio_dim4 is not None: dims_curso_stats[curso_name][3]["suma"] += e.promedio_dim4; dims_curso_stats[curso_name][3]["cuenta"] += 1
        if e.promedio_dim5 is not None: dims_curso_stats[curso_name][4]["suma"] += e.promedio_dim5; dims_curso_stats[curso_name][4]["cuenta"] += 1

    dimensiones_por_curso = {}
    for curso_name, dims in dims_curso_stats.items():
        dimensiones_por_curso[curso_name] = [
            round(d["suma"] / d["cuenta"], 2) if d["cuenta"] > 0 else 0 
            for d in dims
        ]

    # Promedios por Dimensión per Colegio
    dims_col_stats = {}
    for e in evaluaciones:
        col_name = e.docente.colegio.nombre if e.docente and e.docente.colegio else "Sin colegio"
        if col_name not in dims_col_stats:
            dims_col_stats[col_name] = [{"suma": 0.0, "cuenta": 0} for _ in range(5)]
        
        if e.promedio_dim1 is not None: dims_col_stats[col_name][0]["suma"] += e.promedio_dim1; dims_col_stats[col_name][0]["cuenta"] += 1
        if e.promedio_dim2 is not None: dims_col_stats[col_name][1]["suma"] += e.promedio_dim2; dims_col_stats[col_name][1]["cuenta"] += 1
        if e.promedio_dim3 is not None: dims_col_stats[col_name][2]["suma"] += e.promedio_dim3; dims_col_stats[col_name][2]["cuenta"] += 1
        if e.promedio_dim4 is not None: dims_col_stats[col_name][3]["suma"] += e.promedio_dim4; dims_col_stats[col_name][3]["cuenta"] += 1
        if e.promedio_dim5 is not None: dims_col_stats[col_name][4]["suma"] += e.promedio_dim5; dims_col_stats[col_name][4]["cuenta"] += 1

    dimensiones_por_colegio = {}
    for col_name, dims in dims_col_stats.items():
        dimensiones_por_colegio[col_name] = [
            round(d["suma"] / d["cuenta"], 2) if d["cuenta"] > 0 else 0 
            for d in dims
        ]

    return {
        "total_evaluaciones": total,
        "promedio_global": round(promedio_global, 2),
        "promedios_dimensiones": promedios_dims,
        "distribucion_niveles": niveles,
        "por_asignatura": por_asignatura,
        "por_colegio": por_colegio,
        "por_curso": por_curso,
        "dimensiones_por_curso": dimensiones_por_curso,
        "dimensiones_por_colegio": dimensiones_por_colegio
    }


@router.get("/talent-map")
def get_talent_map(
    colegio_id: Optional[int] = Query(None),
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    tipo_vista: str = Query("promedio", description="promedio o ultimo"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    # Consulta base sin restricción de max_id para poder calcular promedios
    query = db.query(Evaluacion).join(Docente)

    if colegio_id:
        query = query.filter(Docente.colegio_id == colegio_id)
    
    if fecha_desde:
        query = query.filter(Evaluacion.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Evaluacion.fecha <= fecha_hasta)

    if current_user.rol_id == 3:
        query = query.filter(Evaluacion.usuario_id == current_user.id)

    evaluaciones = query.all()

    # Agrupar por docente para asegurar unicidad
    docentes_data = {}
    for e in evaluaciones:
        did = e.group_id if hasattr(e, 'group_id') else e.docente_id # Usamos docente_id
        did = e.docente_id
        if did not in docentes_data:
            docentes_data[did] = {
                "nombre": e.docente.nombre if e.docente else "Docente Desconocido",
                "puntajes": [],
                "ultima_orientacion": e.orientacion,
                "ultimo_promedio": e.promedio,
                "ultima_fecha": e.fecha
            }
        
        if e.promedio is not None:
            docentes_data[did]["puntajes"].append(e.promedio)
        
        if e.fecha and (docentes_data[did]["ultima_fecha"] is None or e.fecha >= docentes_data[did]["ultima_fecha"]):
            docentes_data[did]["ultima_fecha"] = e.fecha
            docentes_data[did]["ultima_orientacion"] = e.orientacion
            docentes_data[did]["ultimo_promedio"] = e.promedio

    talent_map_puntaje = {"avanzado": [], "intermedio": [], "en_desarrollo": [], "inicial": []}
    talent_map_orientacion = {"avanzado": [], "intermedio": [], "inicial": [], "prioritario": []}

    for did, data in docentes_data.items():
        if not data["puntajes"]: continue
        
        # Determinar puntaje según tipo de vista
        if tipo_vista == "ultimo":
            display_score = round(data["ultimo_promedio"] or 0, 2)
        else:
            display_score = round(sum(data["puntajes"]) / len(data["puntajes"]), 2)
            
        teacher_info = {"nombre": data["nombre"], "puntaje": display_score}
        
        # Clasificación por Puntaje
        if display_score >= 4.5:
            talent_map_puntaje["avanzado"].append(teacher_info)
        elif display_score >= 3.5:
            talent_map_puntaje["intermedio"].append(teacher_info)
        elif display_score >= 2.5:
            talent_map_puntaje["en_desarrollo"].append(teacher_info)
        else:
            talent_map_puntaje["inicial"].append(teacher_info)
            
        # Clasificación por Orientación (Siempre usa la última registrada por ser estado actual)
        o = (data["ultima_orientacion"] or "").strip().lower()
        if "referente" in o:
            talent_map_orientacion["avanzado"].append(teacher_info)
        elif "desempeño" in o:
            talent_map_orientacion["intermedio"].append(teacher_info)
        elif "desarrollo" in o:
            talent_map_orientacion["inicial"].append(teacher_info)
        elif "acompañamiento" in o:
            talent_map_orientacion["prioritario"].append(teacher_info)
            
    return {
        "puntaje": talent_map_puntaje,
        "orientacion": talent_map_orientacion
    }


@router.get("/{evaluacion_id}", response_model=EvaluacionResponse)
def obtener_evaluacion(
    evaluacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion).options(
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura),
        joinedload(Evaluacion.observador),
        joinedload(Evaluacion.respuestas),
        joinedload(Evaluacion.apoyos),
        joinedload(Evaluacion.fortalezas_aspectos)
    )

    if current_user.rol_id == 3:
        query = query.filter(
            Evaluacion.id == evaluacion_id,
            Evaluacion.usuario_id == current_user.id
        )
    else:
        query = query.filter(Evaluacion.id == evaluacion_id)

    evaluacion = query.first()

    if not evaluacion:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    return build_evaluacion_response(evaluacion)


@router.delete("/{evaluacion_id}")
def eliminar_evaluacion(
    evaluacion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion)

    if current_user.rol_id == 3:
        query = query.filter(
            Evaluacion.id == evaluacion_id,
            Evaluacion.usuario_id == current_user.id
        )
    else:
        query = query.filter(Evaluacion.id == evaluacion_id)

    evaluacion = query.first()

    if not evaluacion:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    db.delete(evaluacion)
    db.commit()
    return {"message": "Evaluación eliminada correctamente"}



