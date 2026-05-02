from django.db import models
from personas.models import Clientes,Empleados

#venta, DetalleVenta

class Venta(models.Model):
    id_venta = models.AutoField(db_column='ID_Venta', primary_key=True)  # Field name made lowercase.
    fechaventa = models.DateField(db_column='FechaVenta')  # Field name made lowercase.
    id_cliente = models.ForeignKey(Clientes, models.DO_NOTHING, db_column='ID_Cliente')  # Field name made lowercase.
    id_empleado = models.ForeignKey(Empleados, models.DO_NOTHING, db_column='ID_Empleado')  # Field name made lowercase.
    total = models.DecimalField(db_column='Total', max_digits=10, decimal_places=2)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Venta'

class Detalleventa(models.Model):
    id_detalleventa = models.AutoField(db_column='ID_DetalleVenta', primary_key=True)  # Field name made lowercase.
    id_venta = models.ForeignKey('Venta', models.DO_NOTHING, db_column='ID_Venta')  # Field name made lowercase.
    id_producto = models.ForeignKey('productos.Productos', models.DO_NOTHING, db_column='ID_Producto')  # Field name made lowercase.
    cantidad = models.IntegerField(db_column='Cantidad')  # Field name made lowercase.
    preciounitario = models.IntegerField(db_column='PrecioUnitario')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'DetalleVenta'

