from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import Usuario, Rol
from schemas import UsuarioCreate, UsuarioResponse, UsuarioUpdate, Token
from auth import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_active_user, require_admin

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=UsuarioResponse)
def register(user: UsuarioCreate, db: Session = Depends(get_db)):
    db_user = db.query(Usuario).filter(
        or_(Usuario.username == user.username, Usuario.email == user.email)
    ).first()
    if db_user:
        if db_user.username == user.username:
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    rol_usuario = db.query(Rol).filter(Rol.nombre == "usuario").first()
    if not rol_usuario:
        rol_usuario = Rol(nombre="usuario")
        db.add(rol_usuario)
        db.commit()
        db.refresh(rol_usuario)
    
    hashed_password = get_password_hash(user.password)
    new_user = Usuario(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        rol_id=rol_usuario.id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.activo == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UsuarioResponse)
def get_me(current_user: Usuario = Depends(get_current_active_user)):
    return current_user


@router.get("/users", response_model=list[UsuarioResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    return db.query(Usuario).order_by(Usuario.id.desc()).all()


@router.put("/users/{user_id}", response_model=UsuarioResponse)
def update_user(
    user_id: int,
    user_update: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user_update.email:
        existing = db.query(Usuario).filter(
            Usuario.email == user_update.email,
            Usuario.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está registrado")
        user.email = user_update.email
    
    if user_update.rol_id is not None:
        user.rol_id = user_update.rol_id
    
    if user_update.activo is not None:
        user.activo = user_update.activo
    
    if user_update.password:
        user.password_hash = get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(user)
    return user


@router.get("/roles", response_model=list)
def list_roles(db: Session = Depends(get_db)):
    return db.query(Rol).all()
