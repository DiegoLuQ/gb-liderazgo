from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
import logging
from typing import List, Optional
import pandas as pd
import io
from datetime import datetime, date

from database import get_db
from models import Evaluacion, EvaluacionRespuesta, EvaluacionApoyo, FortalezaAspecto, Usuario, Curso, Docente, Asignatura, EvaluacionEstado, EmailRecipient
from schemas import EvaluacionCreate, EvaluacionResponse, EvaluacionListResponse, EvaluacionUpdate
from auth import get_current_active_user, require_admin_or_auditor, SECRET_KEY, ALGORITHM
from utils.websocket_manager import manager
from utils.email import send_evaluation_email
from jose import jwt, JWTError
import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")

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
        "fecha_retro": evaluacion.fecha_retro,
        "modalidad_retro": evaluacion.modalidad_retro,
        "sintesis_retro": evaluacion.sintesis_retro,
        "acuerdos_mejora": evaluacion.acuerdos_mejora,
        "estado": evaluacion.estado.value if evaluacion.estado else "BORRADOR",
        "codigo_firma": evaluacion.codigo_firma,
        "fecha_firma_docente": evaluacion.fecha_firma_docente,
        "fecha_guardado": evaluacion.fecha_guardado,
        "docente": {
            "id": evaluacion.docente.id,
            "nombre": evaluacion.docente.nombre,
            "rut": evaluacion.docente.rut,
            "email": evaluacion.docente.email,
            "colegio_id": evaluacion.docente.colegio_id,
            "created_by": evaluacion.docente.created_by,
            "created_at": evaluacion.docente.created_at,
            "totp_secret": evaluacion.docente.totp_secret,
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


@router.get("/public/ver/{codigo}")
def get_public_evaluacion(codigo: str, db: Session = Depends(get_db)):
    evaluacion = db.query(Evaluacion).filter(Evaluacion.codigo_firma == codigo).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado o código inválido")
    
    if evaluacion.estado.value != "CERRADA":
        raise HTTPException(status_code=403, detail="El acompañamiento aún no está finalizado")
        
    return build_evaluacion_response(evaluacion)


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
        comentarios=evaluacion_data.comentarios,
        fecha_retro=evaluacion_data.fecha_retro,
        modalidad_retro=evaluacion_data.modalidad_retro,
        sintesis_retro=evaluacion_data.sintesis_retro,
        acuerdos_mejora=evaluacion_data.acuerdos_mejora
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
            "estado": e.estado.value if e.estado else "BORRADOR",
            "codigo_firma": e.codigo_firma,
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
    anio: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    query = db.query(Evaluacion).join(Docente).options(
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura)
    )
    if colegio_id:
        query = query.filter(Docente.colegio_id == int(colegio_id))
    if asignatura_id:
        query = query.filter(Evaluacion.asignatura_id == int(asignatura_id))

    # Filtrar en Python para máxima compatibilidad con Enums/Fechas
    evaluaciones_raw = query.options(joinedload(Evaluacion.docente)).all()
    
    evaluaciones = []
    for e in evaluaciones_raw:
        if e.estado != EvaluacionEstado.CERRADA:
            continue
        if anio:
            if not e.fecha_firma_docente or e.fecha_firma_docente.year != int(anio):
                continue
        evaluaciones.append(e)

    if fecha_inicio:
        try:
            start_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
            query = query.filter(Evaluacion.fecha_firma_docente >= start_dt)
        except ValueError:
            pass
            
    if fecha_fin:
        try:
            end_dt = datetime.strptime(fecha_fin, '%Y-%m-%d')
            query = query.filter(Evaluacion.fecha_firma_docente <= end_dt)
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
            "por_mes": {m: 0 for m in range(1, 13)},
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
    
    # Armonización de Niveles (Bajo, Regular, Adecuado, Bueno, Muy bueno)
    niveles = {"Bajo": 0, "Regular": 0, "Adecuado": 0, "Bueno": 0, "Muy bueno": 0}
    for e in evaluaciones:
        p = e.promedio
        if p is None: continue
        if p < 2.0: niveles["Bajo"] += 1
        elif p < 3.0: niveles["Regular"] += 1
        elif p < 3.6: niveles["Adecuado"] += 1
        elif p < 4.5: niveles["Bueno"] += 1
        else: niveles["Muy bueno"] += 1
        
    # Agregación por Mes (Cantidad de Acompañamientos)
    por_mes = {m: 0 for m in range(1, 13)}
    for e in evaluaciones:
        if e.fecha_firma_docente:
            por_mes[e.fecha_firma_docente.month] += 1

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

    # Promedios por Dimensión per Docente (NUEVO REQUERIMIENTO)
    dims_docente_stats = {}
    for e in evaluaciones:
        docente_name = e.docente.nombre if e.docente else "Sin docente"
        if docente_name not in dims_docente_stats:
            dims_docente_stats[docente_name] = [{"suma": 0.0, "cuenta": 0} for _ in range(5)]
        
        if e.promedio_dim1 is not None: dims_docente_stats[docente_name][0]["suma"] += e.promedio_dim1; dims_docente_stats[docente_name][0]["cuenta"] += 1
        if e.promedio_dim2 is not None: dims_docente_stats[docente_name][1]["suma"] += e.promedio_dim2; dims_docente_stats[docente_name][1]["cuenta"] += 1
        if e.promedio_dim3 is not None: dims_docente_stats[docente_name][2]["suma"] += e.promedio_dim3; dims_docente_stats[docente_name][2]["cuenta"] += 1
        if e.promedio_dim4 is not None: dims_docente_stats[docente_name][3]["suma"] += e.promedio_dim4; dims_docente_stats[docente_name][3]["cuenta"] += 1
        if e.promedio_dim5 is not None: dims_docente_stats[docente_name][4]["suma"] += e.promedio_dim5; dims_docente_stats[docente_name][4]["cuenta"] += 1

    dimensiones_por_docente = {}
    for doc_name, dims in dims_docente_stats.items():
        dimensiones_por_docente[doc_name] = [
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

    # 10. Distribución de Niveles por Docente (NUEVO REQUERIMIENTO)
    # Calculamos el promedio de cada docente en el periodo filtrado
    docente_promedios = {}
    for e in evaluaciones:
        did = e.docente_id
        if did not in docente_promedios:
            docente_promedios[did] = []
        docente_promedios[did].append(e.promedio)
    
    dist_docentes_niveles = {"Bajo": 0, "Regular": 0, "Adecuado": 0, "Bueno": 0, "Muy bueno": 0}
    for did, scores in docente_promedios.items():
        avg = sum(scores) / len(scores)
        if avg < 2.0: dist_docentes_niveles["Bajo"] += 1
        elif avg < 3.0: dist_docentes_niveles["Regular"] += 1
        elif avg < 3.6: dist_docentes_niveles["Adecuado"] += 1
        elif avg < 4.5: dist_docentes_niveles["Bueno"] += 1
        else: dist_docentes_niveles["Muy bueno"] += 1

    # 11. Distribución Funcionamiento del Grupo (Global)
    dist_func_grupo = {"Bajo": 0, "Regular": 0, "Adecuado": 0, "Bueno": 0, "Muy bueno": 0}
    for e in evaluaciones:
        if e.func_grupo in dist_func_grupo:
            dist_func_grupo[e.func_grupo] += 1

    return {
        "total_evaluaciones": total,
        "promedio_global": round(promedio_global, 2),
        "promedios_dimensiones": promedios_dims,
        "distribucion_niveles": niveles,
        "por_asignatura": por_asignatura,
        "por_colegio": por_colegio,
        "por_curso": por_curso,
        "por_mes": por_mes,
        "dimensiones_por_curso": dimensiones_por_curso,
        "dimensiones_por_docente": dimensiones_por_docente,
        "dimensiones_por_colegio": dimensiones_por_colegio,
        "distribucion_func_grupo": dist_func_grupo,
        "distribucion_docentes_niveles": dist_docentes_niveles
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
        
        # Clasificación por Puntaje (Nueva escala 1-5)
        if display_score >= 4.0:
            talent_map_puntaje["avanzado"].append(teacher_info)
        elif display_score >= 3.0:
            talent_map_puntaje["intermedio"].append(teacher_info)
        elif display_score >= 2.0:
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


@router.put("/{evaluacion_id}", response_model=EvaluacionResponse)
def actualizar_evaluacion(
    evaluacion_id: int,
    eval_data: EvaluacionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    import json
    with open("debug_last_put.json", "w") as f:
        json.dump(eval_data.dict(exclude_unset=True), f, indent=4, default=str)
    
    print(f"DEBUG: Actualizando evaluación {evaluacion_id} con datos guardados en debug_last_put.json")
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == evaluacion_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    
    # Solo se puede editar si el usuario es el creador (o admin) y está en BORRADOR
    if current_user.rol_id == 3 and evaluacion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta evaluación")
    
    if evaluacion.estado != EvaluacionEstado.BORRADOR:
        raise HTTPException(status_code=400, detail="Solo se pueden editar evaluaciones en estado BORRADOR")
    
    if eval_data.sintesis_retro is not None:
        evaluacion.sintesis_retro = eval_data.sintesis_retro
    if eval_data.acuerdos_mejora is not None:
        evaluacion.acuerdos_mejora = eval_data.acuerdos_mejora
    if eval_data.comentarios is not None:
        evaluacion.comentarios = eval_data.comentarios
    if eval_data.fecha_retro is not None:
        evaluacion.fecha_retro = eval_data.fecha_retro
    if eval_data.modalidad_retro is not None:
        evaluacion.modalidad_retro = eval_data.modalidad_retro

    # Actualizar fortalezas y aspectos (reemplazo completo)
    if eval_data.fortalezas_aspectos is not None:
        evaluacion.fortalezas_aspectos.clear()
        db.flush()  # Asegurar que se eliminen antes de insertar
        
        for fa in eval_data.fortalezas_aspectos:
            nueva_fa = FortalezaAspecto(
                evaluacion_id=evaluacion.id,
                tipo=fa.tipo,
                contenido=fa.contenido
            )
            evaluacion.fortalezas_aspectos.append(nueva_fa)
            
    db.commit()
    
    # Recargar la evaluación con todas sus relaciones
    evaluacion_final = db.query(Evaluacion).options(
        joinedload(Evaluacion.fortalezas_aspectos),
        joinedload(Evaluacion.docente).joinedload(Docente.colegio),
        joinedload(Evaluacion.curso).joinedload(Curso.nivel),
        joinedload(Evaluacion.asignatura),
        joinedload(Evaluacion.observador)
    ).filter(Evaluacion.id == evaluacion_id).first()
    
    return build_evaluacion_response(evaluacion_final)


@router.post("/{eval_id}/prepare-sign")
async def prepare_sign(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
    
    # Solo se puede preparar si está en BORRADOR o LISTO_PARA_FIRMA
    if evaluacion.estado not in [EvaluacionEstado.BORRADOR, EvaluacionEstado.LISTO_PARA_FIRMA]:
        raise HTTPException(status_code=400, detail="El estado actual no permite preparar la firma")
    
    evaluacion.estado = EvaluacionEstado.LISTO_PARA_FIRMA
    db.commit()
    return {"message": "Acompañamiento listo para firma", "estado": evaluacion.estado.value}


@router.get("/{eval_id}/sign-token")
async def get_sign_token(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
    
    if evaluacion.estado != EvaluacionEstado.LISTO_PARA_FIRMA:
        raise HTTPException(status_code=400, detail="El acompañamiento no está listo para firma")
    
    # Crear un token de corta duración (10 min) para el QR
    import time
    payload = {
        "eval_id": eval_id,
        "docente_id": evaluacion.docente_id,
        "exp": time.time() + 600  # 10 minutos
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token}


@router.get("/public-detail")
async def get_public_detail(
    token: str,
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        eval_id = payload.get("eval_id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
        
    return {
        "id": evaluacion.id,
        "docente_nombre": evaluacion.docente.nombre,
        "colegio_nombre": evaluacion.docente.colegio.nombre,
        "curso": f"{evaluacion.curso.nivel.nombre} {evaluacion.curso.letra}",
        "asignatura": evaluacion.asignatura.nombre,
        "fecha": evaluacion.fecha,
        "promedio": float(evaluacion.promedio) if evaluacion.promedio else 0.0,
        "estado": evaluacion.estado.value
    }


@router.post("/public-sign")
async def public_sign(
    data: dict,  # {"token": "...", "code": "123456"}
    db: Session = Depends(get_db)
):
    token = data.get("token")
    code = data.get("code")
    
    if not token or not code:
        raise HTTPException(status_code=400, detail="Token y código TOTP son requeridos")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        eval_id = payload.get("eval_id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
    
    if evaluacion.estado != EvaluacionEstado.LISTO_PARA_FIRMA:
        raise HTTPException(status_code=400, detail="El acompañamiento ya no está disponible para firma")
    
    # Verificar TOTP del docente
    import pyotp
    if not evaluacion.docente.totp_secret:
        raise HTTPException(status_code=400, detail="El docente no tiene configurada la firma digital")
        
    totp = pyotp.TOTP(evaluacion.docente.totp_secret)
    if totp.verify(code):
        import secrets
        # Generar código único de verificación (ej: FA-7B8C29)
        verif_code = f"FA-{secrets.token_hex(3).upper()}"
        
        evaluacion.estado = EvaluacionEstado.CERRADA
        evaluacion.fecha_firma_docente = datetime.now()
        evaluacion.codigo_firma = verif_code
        db.commit()
        
        # NOTIFICAR POR WEBSOCKET
        await manager.notify_signature(eval_id, {
            "event": "DOCENTE_FIRMO",
            "docente_nombre": evaluacion.docente.nombre,
            "verificacion": verif_code,
            "timestamp": datetime.now().isoformat()
        })
        
        # Generar link para que el observador comparta (reusamos el token de acceso si existe o pasamos el ID)
        # En este sistema, el link de firma (firmar.html?token=...) sirve para ver el estado también
        public_link = f"{BASE_URL}/firmar.html?token={token or ''}" # El token viene del request
        
        return {
            "message": "Firma realizada exitosamente",
            "codigo_verificacion": verif_code,
            "public_link": public_link
        }
    else:
        raise HTTPException(status_code=400, detail="Código TOTP incorrecto")


@router.post("/{eval_id}/finalize")
async def finalize_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
    
    if evaluacion.estado != EvaluacionEstado.FIRMADA_DOCENTE:
        raise HTTPException(status_code=400, detail="El docente debe firmar antes de cerrar")
    
    evaluacion.estado = EvaluacionEstado.CERRADA
    db.commit()
    return {"message": "Acompañamiento cerrado definitivamente", "estado": evaluacion.estado.value}


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


@router.post("/{eval_id}/send-email")
async def send_email_accompaniment(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user)
):
    evaluacion = db.query(Evaluacion).filter(Evaluacion.id == eval_id).first()
    if not evaluacion:
        raise HTTPException(status_code=404, detail="Acompañamiento no encontrado")
    
    # 1. Recopilar destinatarios
    recipients = []
    
    # Email del docente (Destinatario Principal)
    if evaluacion.docente and evaluacion.docente.email:
        recipients.append(evaluacion.docente.email)
    
    # 2. Recopilar destinatarios con copia (CC)
    cc_list = []
    
    # Email del observador (con copia)
    if evaluacion.observador and evaluacion.observador.email:
        cc_list.append(evaluacion.observador.email)
    
    # Otros destinatarios con copia (CC) filtrados por colegio
    from sqlalchemy import or_
    docente_colegio_id = evaluacion.docente.colegio_id
    extras = db.query(EmailRecipient).filter(
        EmailRecipient.activo == True,
        or_(EmailRecipient.colegio_id == docente_colegio_id, EmailRecipient.colegio_id == None)
    ).all()
    cc_list.extend([extra.email for extra in extras])
    
    # Eliminar duplicados
    recipients = list(set(recipients))
    cc_list = list(set(cc_list))
    
    if not recipients and not cc_list:
        raise HTTPException(status_code=400, detail="No hay destinatarios válidos para enviar el correo")
    
    # 2. Enviar correo
    subject = f"Acompañamiento de Liderazgo - {evaluacion.docente.nombre}"
    
    # Texto plano para clientes que no soportan HTML
    body_plain = f"""
    Estimado/a {evaluacion.docente.nombre},
    
    Se ha generado un nuevo registro del acompañamiento de liderazgo realizado el {evaluacion.fecha.strftime('%d/%m/%Y') if evaluacion.fecha else 'N/A'}.
    
    Docente: {evaluacion.docente.nombre}
    Estado: {evaluacion.estado.value}
    Verificación: {evaluacion.codigo_firma or 'N/A'}
    
    Puede visualizar el acta oficial en línea en el siguiente enlace:
    {BASE_URL}/ver-acta.html?c={evaluacion.codigo_firma}
    """
    
    # Versión HTML Profesional
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Inter', sans-serif, Arial; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f9; }}
            .container {{ max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #e1e8ed; }}
            .header {{ background: linear-gradient(135deg, #002b5e 0%, #004080 100%); color: #ffffff; padding: 35px 25px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; text-transform: uppercase; }}
            .header p {{ margin: 8px 0 0; font-size: 14px; opacity: 0.9; font-style: italic; font-weight: 300; }}
            .content {{ padding: 30px 40px; }}
            .greeting {{ font-size: 18px; font-weight: 600; color: #002b5e; margin-bottom: 20px; }}
            .data-table {{ width: 100%; border-collapse: separate; border-spacing: 0; margin: 25px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }}
            .data-table td {{ padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }}
            .data-table tr:last-child td {{ border-bottom: none; }}
            .label {{ font-weight: 700; color: #64748b; width: 35%; }}
            .value {{ color: #1e293b; font-weight: 500; }}
            .status-badge {{ background: #28a745; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; }}
            .btn-container {{ text-align: center; margin: 35px 0 10px; }}
            .btn {{ background-color: #004080; color: #ffffff !important; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(0,64,128,0.2); }}
            .footer {{ background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
            .footer p {{ margin: 5px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Acompañamiento Liderazgo</h1>
                <p>Fortaleciendo el liderazgo educativo para una gestión de excelencia</p>
            </div>
            <div class="content">
                <div class="greeting">Estimado/a {evaluacion.docente.nombre},</div>
                <p>Se ha generado el registro oficial del acompañamiento de liderazgo realizado. Ya puede visualizar las observaciones y acuerdos alcanzados durante la sesión.</p>
                
                <table class="data-table">
                    <tr>
                        <td class="label">Docente</td>
                        <td class="value">{evaluacion.docente.nombre}</td>
                    </tr>
                    <tr>
                        <td class="label">Fecha</td>
                        <td class="value">{evaluacion.fecha.strftime('%d/%m/%Y') if evaluacion.fecha else 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="label">Estado</td>
                        <td class="value"><span class="status-badge">{evaluacion.estado.value}</span></td>
                    </tr>
                    <tr>
                        <td class="label">Verificación</td>
                        <td class="value" style="font-family: monospace; font-weight: 700; color: #004080;">{evaluacion.codigo_firma or 'N/A'}</td>
                    </tr>
                    <tr style="background-color: #e2e8f0;">
                         <td class="label" style="color: #002b5e;">Promedio Liderazgo</td>
                         <td class="value" style="font-size: 16px; font-weight: 800; color: #002b5e;">{f"{evaluacion.promedio:.2f}" if evaluacion.promedio else "N/A"}</td>
                    </tr>
                </table>
                
                <div class="btn-container">
                    <a href="{BASE_URL}/ver-acta.html?c={evaluacion.codigo_firma}" class="btn">Visualizar Acta Oficial</a>
                </div>
            </div>
            <div class="footer">
                <p><strong>Sistema de Gestión de Liderazgo</strong></p>
                <p>Colegio Diego Portales y Macaya - Red de Acompañamiento</p>
                <p>© {datetime.now().year} - Equipo de Innovación Tecnológica</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    success = send_evaluation_email(
        to_emails=recipients,
        subject=subject,
        body=body_plain,
        body_html=body_html,
        cc_emails=cc_list
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Error al enviar el correo")
        
    return {"message": "Correo enviado exitosamente", "recipients": recipients}



