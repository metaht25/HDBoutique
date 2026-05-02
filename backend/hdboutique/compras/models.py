from django.db import models


# compra, DetalleCompra

class Compras(models.Model):
    id_compra = models.AutoField(db_column='ID_Compra', primary_key=True)  # Field name made lowercase.
    id_proveedor = models.ForeignKey('proveedores.Proveedores', models.DO_NOTHING, db_column='ID_Proveedor')  # Field name made lowercase.
    id_empleado = models.ForeignKey('personas.Empleados', models.DO_NOTHING, db_column='ID_Empleado')  # Field name made lowercase.
    fecharevision = models.DateField(db_column='FechaRevision', blank=True, null=True)  # Field name made lowercase.
    fechacompra = models.DateField(db_column='FechaCompra')  # Field name made lowercase.
    costodeenvio = models.DecimalField(db_column='CostoDeEnvio', max_digits=10, decimal_places=2, blank=True, null=True)  # Field name made lowercase.
    fecharelleno = models.DateField(db_column='FechaRelleno', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Compras'

class Detallecompra(models.Model):
    id_detallecompra = models.AutoField(db_column='ID_DetalleCompra', primary_key=True)  # Field name made lowercase.
    id_productoproveedor = models.ForeignKey('proveedores.Productoproveedor', models.DO_NOTHING, db_column='ID_ProductoProveedor')  # Field name made lowercase.
    id_compra = models.ForeignKey(Compras, models.DO_NOTHING, db_column='ID_Compra')  # Field name made lowercase.
    cantidad = models.IntegerField(db_column='Cantidad')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'DetalleCompra'