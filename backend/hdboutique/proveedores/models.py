from django.db import models
from ubicaciones.models import Direccion


# proveedores,categorias,tallas

class Proveedores(models.Model):
    id_proveedor = models.AutoField(db_column='ID_Proveedor', primary_key=True)  # Field name made lowercase.
    id_direccion = models.ForeignKey(Direccion, models.DO_NOTHING, db_column='ID_Direccion')  # Field name made lowercase.
    nombreempresa = models.CharField(db_column='NombreEmpresa', max_length=50, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    nombrecontacto = models.CharField(db_column='NombreContacto', max_length=50, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    apellidocontacto = models.CharField(db_column='ApellidoContacto', max_length=50, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    numerotelefono = models.CharField(db_column='NumeroTelefono', max_length=10, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    correoprofesional = models.CharField(db_column='CorreoProfesional', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Proveedores'

class Ofrece(models.Model):
    id_proveedor = models.ForeignKey('Proveedores', models.DO_NOTHING, db_column='ID_Proveedor')  # Field name made lowercase.
    id_productoproveedor = models.ForeignKey('Productoproveedor', models.DO_NOTHING, db_column='ID_ProductoProveedor')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Ofrece'

class Productoproveedor(models.Model):
    id_productoproveedor = models.AutoField(db_column='ID_ProductoProveedor', primary_key=True)
    id_producto = models.ForeignKey('productos.Productos', models.DO_NOTHING, db_column='ID_Producto')
    preciodecompra = models.DecimalField(db_column='PrecioDeCompra', max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'ProductoProveedor'
