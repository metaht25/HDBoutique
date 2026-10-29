"""Concrete catalog persistence; callers own the transaction."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Category, Product, Size


class CatalogRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_category(self, offset: int, limit: int) -> list[Category]:
        return list(
            self.session.scalars(
                select(Category)
                .order_by(Category.category_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_category(self, record_id: int) -> Category | None:
        return self.session.get(Category, record_id)

    def add_category(self, record: Category) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_category(self, record: Category) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_category_references(self, values: dict[str, object]) -> bool:
        return True

    def list_size(self, offset: int, limit: int) -> list[Size]:
        return list(
            self.session.scalars(
                select(Size).order_by(Size.size_id).offset(offset).limit(limit)
            )
        )

    def get_size(self, record_id: int) -> Size | None:
        return self.session.get(Size, record_id)

    def add_size(self, record: Size) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_size(self, record: Size) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_size_references(self, values: dict[str, object]) -> bool:
        return True

    def list_product(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Product]:
        statement = select(Product)
        if query:
            statement = statement.where(Product.name.icontains(query, autoescape=True))
        return list(
            self.session.scalars(
                statement.order_by(Product.product_id).offset(offset).limit(limit)
            )
        )

    def get_product(self, record_id: int) -> Product | None:
        return self.session.get(Product, record_id)

    def add_product(self, record: Product) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_product(self, record: Product) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_product_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "category_id" not in values
                or self.session.get(Category, values["category_id"]) is not None,
                "size_id" not in values
                or self.session.get(Size, values["size_id"]) is not None,
            )
        )
