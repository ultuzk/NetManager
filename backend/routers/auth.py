"""
账号管理路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from ..database import get_db
from ..schemas import ResponseModel
from ..services.auth_service import AuthService
from ..services.log_service import LogService
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["账号管理"])


# ========== 请求模型 ==========

class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=50)
    role: str = Field(default="operator")
    real_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    permissions: Optional[str] = "device_manage,group_manage,inspection_manage,backup_manage,ai_manage"


class UserUpdateRequest(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None
    real_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[str] = None


# ========== 登录/登出 ==========

@router.post("/login/", response_model=ResponseModel)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = AuthService.authenticate(db, request.username, request.password)
    if not user:
        # 记录失败日志
        LogService.add_operation_log(
            db, username=request.username, action="login",
            target_type="account", detail=f"登录失败: {request.username}",
            result="failed", error_message="用户名或密码错误"
        )
        return ResponseModel(success=False, message="用户名或密码错误")

    # 更新登录信息
    user.last_login_time = datetime.now()
    db.commit()

    # 记录成功日志
    LogService.add_operation_log(
        db, user_id=user.id, username=user.username, action="login",
        target_type="account", detail=f"登录成功: {user.username}",
        result="success"
    )

    return ResponseModel(
        success=True,
        message="登录成功",
        data=AuthService.to_dict(user),
    )


@router.post("/logout/", response_model=ResponseModel)
def logout(user_id: int = Query(None), username: str = Query(""), db: Session = Depends(get_db)):
    LogService.add_operation_log(
        db, user_id=user_id, username=username, action="logout",
        target_type="account", detail=f"登出: {username}",
    )
    return ResponseModel(success=True, message="登出成功")


# ========== 账号 CRUD ==========

@router.post("/users/", response_model=ResponseModel)
def create_user(request: UserCreateRequest, db: Session = Depends(get_db)):
    try:
        user = AuthService.create_user(
            db,
            username=request.username,
            password=request.password,
            role=request.role,
            real_name=request.real_name or "",
            email=request.email or "",
            phone=request.phone or "",
            permissions=request.permissions or "",
        )
        LogService.add_operation_log(
            db, username="system", action="create",
            target_type="account", target_id=user.id, target_name=user.username,
            detail=f"创建账号: {user.username}, 角色: {user.role}",
        )
        return ResponseModel(success=True, message="账号创建成功", data=AuthService.to_dict(user))
    except ValueError as e:
        return ResponseModel(success=False, message=str(e))
    except Exception as e:
        return ResponseModel(success=False, message=f"创建失败: {str(e)}")


@router.get("/users/", response_model=ResponseModel)
def get_users(
    skip: int = 0,
    limit: int = 100,
    keyword: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
):
    users = AuthService.get_users(db, skip, limit, keyword=keyword, role=role)
    return ResponseModel(
        success=True,
        data=[AuthService.to_dict(u) for u in users],
    )


@router.get("/users/{user_id}/", response_model=ResponseModel)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = AuthService.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="账号不存在")
    return ResponseModel(success=True, data=AuthService.to_dict(user))


@router.put("/users/{user_id}/", response_model=ResponseModel)
def update_user(user_id: int, request: UserUpdateRequest, db: Session = Depends(get_db)):
    update_data = request.model_dump(exclude_unset=True)
    if not update_data:
        return ResponseModel(success=False, message="没有要更新的字段")

    user = AuthService.update_user(db, user_id, **update_data)
    if not user:
        raise HTTPException(status_code=404, detail="账号不存在")

    LogService.add_operation_log(
        db, username="system", action="update",
        target_type="account", target_id=user.id, target_name=user.username,
        detail=f"更新账号: {user.username}",
    )
    return ResponseModel(success=True, message="更新成功", data=AuthService.to_dict(user))


@router.delete("/users/{user_id}/", response_model=ResponseModel)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    try:
        success = AuthService.delete_user(db, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="账号不存在")
        LogService.add_operation_log(
            db, username="system", action="delete",
            target_type="account", target_id=user_id,
            detail=f"删除账号 ID: {user_id}",
        )
        return ResponseModel(success=True, message="删除成功")
    except ValueError as e:
        return ResponseModel(success=False, message=str(e))
    except Exception as e:
        return ResponseModel(success=False, message=f"删除失败: {str(e)}")
