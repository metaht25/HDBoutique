"""Explicit locations contracts preserving initial compatibility limits."""

from typing import Annotated

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel


class DepartmentCreate(InputModel):
    name: Annotated[str, Field(max_length=40, min_length=1, strict=True)]


class DepartmentPatch(PatchModel):
    required_fields = frozenset(["name"])
    name: Annotated[str | None, Field(max_length=40, min_length=1, strict=True)] = None


class DepartmentRead(OutputModel):
    is_permanent: bool = False
    department_id: int
    name: Annotated[str, Field(max_length=40, min_length=1, strict=True)]


class MunicipalityCreate(InputModel):
    department_id: Annotated[int, Field(gt=0, strict=True)]
    name: Annotated[str, Field(min_length=1, max_length=40, strict=True)]


class MunicipalityPatch(PatchModel):
    required_fields = frozenset(["department_id", "name"])
    department_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    name: Annotated[str | None, Field(min_length=1, max_length=40, strict=True)] = None


class MunicipalityRead(OutputModel):
    is_permanent: bool = False
    municipality_id: int
    department_id: Annotated[int, Field(gt=0, strict=True)]
    name: Annotated[str | None, Field(max_length=40, strict=True)]


class AddressCreate(InputModel):
    municipality_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    department_id: Annotated[int, Field(gt=0, strict=True)]
    address_line: Annotated[str | None, Field(max_length=100, strict=True)] = None


class AddressPatch(PatchModel):
    municipality_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    required_fields = frozenset(["department_id"])
    department_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    address_line: Annotated[str | None, Field(max_length=100, strict=True)] = None


class AddressRead(OutputModel):
    municipality_id: int | None = None
    address_id: int
    department_id: Annotated[int, Field(gt=0, strict=True)]
    address_line: Annotated[str | None, Field(max_length=100, strict=True)]
