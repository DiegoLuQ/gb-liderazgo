from pydantic import BaseModel, EmailStr, computed_field, Field
from datetime import date, datetime
from typing import Optional, List, Any


class RolBase(BaseModel):
    nombre: str


class RolResponse(RolBase):
    id: int

    class Config:
        from_attributes = True


class UsuarioBase(BaseModel):
    username: str
    email: str


class UsuarioCreate(UsuarioBase):
    password: str


class UsuarioResponse(UsuarioBase):
    id: int
    rol_id: int
    activo: int
    rol: Optional[RolResponse] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class UsuarioUpdate(BaseModel):
    email: Optional[str] = None
    rol_id: Optional[int] = None
    activo: Optional[int] = None
    password: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class ColegioBase(BaseModel):
    nombre: str
    direccion: Optional[str] = None


class ColegioCreate(ColegioBase):
    pass


class ColegioResponse(ColegioBase):
    id: int
    created_by: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class NivelBase(BaseModel):
    nombre: str
    orden: Optional[int] = 0


class NivelCreate(NivelBase):
    pass


class NivelResponse(NivelBase):
    id: int

    class Config:
        from_attributes = True


class CursoBase(BaseModel):
    nivel_id: int
    letra: str


class CursoCreate(CursoBase):
    pass


class CursoResponse(CursoBase):
    id: int
    nivel: Optional[NivelResponse] = None
    created_by: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AsignaturaBase(BaseModel):
    nombre: str


class AsignaturaCreate(AsignaturaBase):
    pass


class AsignaturaResponse(AsignaturaBase):
    id: int
    created_by: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DocenteBase(BaseModel):
    nombre: str
    rut: str
    email: Optional[str] = None
    colegio_id: int


class DocenteCreate(DocenteBase):
    pass


class DocenteResponse(DocenteBase):
    id: int
    created_by: Optional[int]
    created_at: Optional[datetime]
    colegio: Optional[ColegioResponse] = None
    totp_secret: Optional[str] = Field(None, exclude=True)
    @computed_field
    @property
    def has_totp(self) -> bool:
        return bool(self.totp_secret)

    class Config:
        from_attributes = True


class DimensionBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    orden: Optional[int] = 0


class DimensionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class DimensionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


class DimensionResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    orden: int
    subdimensiones: List["SubdimensionResponse"] = []

    class Config:
        from_attributes = True


class SubdimensionBase(BaseModel):
    dimension_id: int
    nombre: str
    descripcion: Optional[str] = None
    orden: Optional[int] = 0


class SubdimensionCreate(BaseModel):
    dimension_id: int
    nombre: str
    descripcion: Optional[str] = None


class SubdimensionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


class SubdimensionResponse(BaseModel):
    id: int
    dimension_id: int
    nombre: str
    descripcion: Optional[str] = None
    orden: int

    class Config:
        from_attributes = True


class ReorderRequest(BaseModel):
    ids: List[int]


class RespuestaInput(BaseModel):
    subdimension_id: int
    valor: int


class ApoyoInput(BaseModel):
    apoyo: str


class FortalezaAspectoInput(BaseModel):
    tipo: str
    contenido: str


class EvaluacionCreate(BaseModel):
    docente_id: int
    curso_id: int
    asignatura_id: int
    fecha: date
    duracion: Optional[str] = None
    func_grupo: str
    promedio: float
    promedio_dim1: Optional[float] = None
    promedio_dim2: Optional[float] = None
    promedio_dim3: Optional[float] = None
    promedio_dim4: Optional[float] = None
    promedio_dim5: Optional[float] = None
    orientacion: str
    nivel_apoyo: str
    comentarios: Optional[str] = None
    # Sección X
    fecha_retro: Optional[date] = None
    modalidad_retro: Optional[str] = None
    sintesis_retro: Optional[str] = None
    acuerdos_mejora: Optional[str] = None
    respuestas: List[RespuestaInput]
    apoyos: List[ApoyoInput]
    fortalezas_aspectos: List[FortalezaAspectoInput]


class EvaluacionUpdate(BaseModel):
    sintesis_retro: Optional[str] = None
    acuerdos_mejora: Optional[str] = None
    comentarios: Optional[str] = None
    fecha_retro: Optional[date] = None
    modalidad_retro: Optional[str] = None
    fortalezas_aspectos: Optional[List[FortalezaAspectoInput]] = None


class EvaluacionRespuestaResponse(BaseModel):
    id: int
    subdimension_id: int
    valor: int

    class Config:
        from_attributes = True


class EvaluacionApoyoResponse(BaseModel):
    id: int
    apoyo: str

    class Config:
        from_attributes = True


class FortalezaAspectoResponse(BaseModel):
    id: int
    tipo: str
    contenido: str

    class Config:
        from_attributes = True


class EvaluacionResponse(BaseModel):
    id: int
    usuario_id: int
    docente_id: int
    curso_id: int
    asignatura_id: int
    observador_id: int
    fecha: date
    duracion: Optional[str]
    func_grupo: str
    promedio: float
    promedio_dim1: Optional[float] = None
    promedio_dim2: Optional[float] = None
    promedio_dim3: Optional[float] = None
    promedio_dim4: Optional[float] = None
    promedio_dim5: Optional[float] = None
    orientacion: str
    nivel_apoyo: str
    comentarios: Optional[str]
    # Sección X
    fecha_retro: Optional[date]
    modalidad_retro: Optional[str]
    sintesis_retro: Optional[str]
    acuerdos_mejora: Optional[str]
    estado: str
    codigo_firma: Optional[str] = None
    fecha_guardado: Optional[datetime]
    docente: Optional[DocenteResponse] = None
    curso: Optional[CursoResponse] = None
    asignatura: Optional[AsignaturaResponse] = None
    observador: Optional[UsuarioResponse] = None
    respuestas: List[EvaluacionRespuestaResponse] = []
    apoyos: List[EvaluacionApoyoResponse] = []
    fortalezas_aspectos: List[FortalezaAspectoResponse] = []

    class Config:
        from_attributes = True


class EvaluacionListResponse(BaseModel):
    id: int
    fecha: date
    promedio: float
    func_grupo: Optional[str] = None
    docente_id: int
    docente_nombre: Optional[str] = None
    colegio_id: Optional[int] = None
    colegio_nombre: Optional[str] = None
    curso_nombre: Optional[str] = None
    asignatura_nombre: Optional[str] = None
    observador_nombre: Optional[str] = None
    estado: str
    codigo_firma: Optional[str] = None
    fecha_guardado: Optional[datetime]

    class Config:
        from_attributes = True


DimensionResponse.model_rebuild()
