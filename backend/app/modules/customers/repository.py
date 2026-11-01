"""Concrete customers persistence; callers own the transaction."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.customers.models import Customer, CustomerType
from app.modules.locations.models import Address


class CustomersRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_customer_type(self, offset: int, limit: int) -> list[CustomerType]:
        return list(
            self.session.scalars(
                select(CustomerType)
                .order_by(CustomerType.customer_type_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_customer_type(self, record_id: int) -> CustomerType | None:
        return self.session.get(CustomerType, record_id)

    def add_customer_type(self, record: CustomerType) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_customer_type(self, record: CustomerType) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_customer_type_references(self, values: dict[str, object]) -> bool:
        return True

    def list_customer(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Customer]:
        statement = select(Customer)
        if query:
            statement = statement.where(
                or_(
                    (Customer.first_names + " " + Customer.last_names).icontains(
                        query, autoescape=True
                    ),
                    Customer.phone_number.icontains(query, autoescape=True),
                )
            )
        return list(
            self.session.scalars(
                statement.order_by(Customer.customer_id).offset(offset).limit(limit)
            )
        )

    def get_customer(self, record_id: int) -> Customer | None:
        return self.session.get(Customer, record_id)

    def add_customer(self, record: Customer) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_customer(self, record: Customer) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_customer_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                values.get("address_id") is None
                or self.session.get(Address, values["address_id"]) is not None,
                values.get("customer_type_id") is None
                or self.session.get(CustomerType, values["customer_type_id"])
                is not None,
            )
        )
