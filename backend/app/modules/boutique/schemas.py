"""Owner profile and receipt contracts; no upload path is accepted."""

from typing import Annotated

from pydantic import BaseModel, Field

from app.api.schemas import InputModel
from app.modules.sales.schemas import SaleRead


class ProfileWrite(InputModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    phone_number: Annotated[str, Field(min_length=1, max_length=30)]
    address_line: Annotated[str, Field(min_length=1, max_length=250)]
    logo_base64: Annotated[str | None, Field(max_length=2800000)] = None
    remove_logo: bool = False


class ProfileRead(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    address_line: str | None = None
    logo_base64: str | None = None
    ready: bool = False


class ReceiptRead(BaseModel):
    receipt_number: str
    sale_number: str
    boutique: ProfileRead
    sale: SaleRead
