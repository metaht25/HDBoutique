"""Explicit physical legacy names, pending verification against an authorized copy."""

from dataclasses import dataclass

from sqlalchemy import Table

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base

MAPPING_VERSION = "compatibility-1"
SCHEMA_REVISION = "0002_identity"


@dataclass(frozen=True)
class TableMapping:
    source: str
    target: str
    fields: tuple[tuple[str, str], ...]

    @property
    def table(self) -> Table:
        return Base.metadata.tables[self.target]

    @property
    def primary_key(self) -> str:
        return next(iter(self.table.primary_key.columns)).name


def mapping(source: str, target: str, fields: str) -> TableMapping:
    return TableMapping(
        source,
        target,
        tuple((a, b) for a, b in (pair.split("=") for pair in fields.split())),
    )


# Ofrece.id is a canonical export slot, NOT a claim about its physical primary key.
# Extraction requires an explicitly named and inventoried single integer PK.
MAPPINGS = (
    mapping(
        "Departamento", "departments", "ID_Departamento=department_id Departamento=name"
    ),
    mapping(
        "Municipio",
        "municipalities",
        "ID_Municipio=municipality_id ID_Departamento=department_id Municipio=name",
    ),
    mapping(
        "Direccion",
        "addresses",
        "ID_Direccion=address_id ID_Departamento=department_id Direccion=address_line",
    ),
    mapping(
        "Tipo_Cliente", "customer_types", "ID_Tipo_Cliente=customer_type_id Tipo=name"
    ),
    mapping("Categoria", "categories", "ID_Categoria=category_id Categoria=name"),
    mapping("Tallas", "sizes", "ID_Talla=size_id Talla=name"),
    mapping(
        "Clientes",
        "customers",
        "ID_Cliente=customer_id ID_Direccion=address_id "
        "ID_Tipo_Cliente=customer_type_id Nombres=first_names "
        "Apellidos=last_names NumeroTelefono=phone_number",
    ),
    mapping(
        "Empleados",
        "employees",
        "ID_Empleado=employee_id ID_Direccion=address_id "
        "Nombres=first_names Apellidos=last_names "
        "NumeroTelefonico=phone_number CorreoProfesional=work_email "
        "Cargo=job_title FechaInicio=start_date FechaFin=end_date",
    ),
    mapping(
        "Productos",
        "products",
        "ID_Producto=product_id ID_Categoria=category_id "
        "ID_Talla=size_id Nombre=name "
        "CantidadStock=legacy_stock_quantity Stock=legacy_stock "
        "PrecioUnitario=unit_price",
    ),
    mapping(
        "Proveedores",
        "suppliers",
        "ID_Proveedor=supplier_id ID_Direccion=address_id "
        "NombreEmpresa=company_name "
        "NombreContacto=contact_first_names "
        "ApellidoContacto=contact_last_names "
        "NumeroTelefono=phone_number CorreoProfesional=work_email",
    ),
    mapping(
        "ProductoProveedor",
        "supplier_products",
        "ID_ProductoProveedor=supplier_product_id "
        "ID_Producto=product_id PrecioDeCompra=purchase_price",
    ),
    mapping(
        "Ofrece",
        "supplier_offerings",
        "id=offering_id ID_Proveedor=supplier_id "
        "ID_ProductoProveedor=supplier_product_id",
    ),
    mapping(
        "Compras",
        "purchases",
        "ID_Compra=purchase_id ID_Proveedor=supplier_id "
        "ID_Empleado=employee_id FechaCompra=purchase_date "
        "FechaRevision=review_date FechaRelleno=refill_date "
        "CostoDeEnvio=shipping_cost",
    ),
    mapping(
        "DetalleCompra",
        "purchase_items",
        "ID_DetalleCompra=purchase_item_id "
        "ID_ProductoProveedor=supplier_product_id "
        "ID_Compra=purchase_id Cantidad=quantity",
    ),
    mapping(
        "Venta",
        "sales",
        "ID_Venta=sale_id ID_Cliente=customer_id "
        "ID_Empleado=employee_id FechaVenta=sale_date Total=total",
    ),
    mapping(
        "DetalleVenta",
        "sale_items",
        "ID_DetalleVenta=sale_item_id ID_Venta=sale_id "
        "ID_Producto=product_id Cantidad=quantity "
        "PrecioUnitario=unit_price",
    ),
    mapping(
        "Deuda_Cliente",
        "customer_payments",
        "ID_Deuda=payment_id ID_Cliente=customer_id ID_Venta=sale_id "
        "Fecha_Abono=payment_date Abono=amount",
    ),
)


def mapping_document() -> dict[str, object]:
    return {
        "mapping_version": MAPPING_VERSION,
        "schema_revision": SCHEMA_REVISION,
        "physical_schema_verified": False,
        "offering_identity": "requires verified physical single integer primary key",
        "tables": [
            {
                "source": item.source,
                "target": item.target,
                "fields": [
                    {
                        "source": source,
                        "target": target,
                        "type": str(item.table.c[target].type),
                        "nullable": item.table.c[target].nullable,
                    }
                    for source, target in item.fields
                ],
            }
            for item in MAPPINGS
        ],
    }
