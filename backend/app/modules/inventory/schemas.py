"""Read-only inventory entries; no independent stock mutation API."""

from datetime import datetime
from typing import Literal

from app.api.schemas import OutputModel


class MovementRead(OutputModel):
    movement_id: int
    product_id: int
    purchase_item_id: int
    movement_type: Literal["purchase_receipt"]
    quantity: int
    stock_before: int
    stock_after: int
    created_at: datetime
    performed_by_user_id: int
    employee_id: int
