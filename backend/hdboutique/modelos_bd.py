# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models

#productos(COPIADA)
class Categoria(models.Model):
    id_categoria = models.AutoField(db_column='ID_Categoria', primary_key=True)  # Field name made lowercase.
    categoria = models.CharField(db_column='Categoria', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Categoria'

#personas (COPIADA)
class Clientes(models.Model):
    id_cliente = models.AutoField(db_column='ID_Cliente', primary_key=True)  # Field name made lowercase.
    id_direccion = models.ForeignKey('Direccion', models.DO_NOTHING, db_column='ID_Direccion')  # Field name made lowercase.
    id_tipo_cliente = models.ForeignKey('TipoCliente', models.DO_NOTHING, db_column='ID_Tipo_Cliente')  # Field name made lowercase.
    nombres = models.CharField(db_column='Nombres', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    apellidos = models.CharField(db_column='Apellidos', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    numerotelefono = models.CharField(db_column='NumeroTelefono', max_length=10, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Clientes'

#compras (COPIADA)
class Compras(models.Model):
    id_compra = models.AutoField(db_column='ID_Compra', primary_key=True)  # Field name made lowercase.
    id_proveedor = models.ForeignKey('Proveedores', models.DO_NOTHING, db_column='ID_Proveedor')  # Field name made lowercase.
    id_empleado = models.ForeignKey('Empleados', models.DO_NOTHING, db_column='ID_Empleado')  # Field name made lowercase.
    fecharevision = models.DateField(db_column='FechaRevision', blank=True, null=True)  # Field name made lowercase.
    fechacompra = models.DateField(db_column='FechaCompra')  # Field name made lowercase.
    costodeenvio = models.DecimalField(db_column='CostoDeEnvio', max_digits=10, decimal_places=2, blank=True, null=True)  # Field name made lowercase.
    fecharelleno = models.DateField(db_column='FechaRelleno', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Compras'

#ubicaciones (COPIADA)
class Departamento(models.Model):
    id_departamento = models.AutoField(db_column='ID_Departamento', primary_key=True)  # Field name made lowercase.
    departamento = models.CharField(db_column='Departamento', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Departamento'

#compras (COPIADA)
class Detallecompra(models.Model):
    id_detallecompra = models.AutoField(db_column='ID_DetalleCompra', primary_key=True)  # Field name made lowercase.
    id_productoproveedor = models.ForeignKey('Productoproveedor', models.DO_NOTHING, db_column='ID_ProductoProveedor')  # Field name made lowercase.
    id_compra = models.ForeignKey(Compras, models.DO_NOTHING, db_column='ID_Compra')  # Field name made lowercase.
    cantidad = models.IntegerField(db_column='Cantidad')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'DetalleCompra'

#ventas (Copiada)
class Detalleventa(models.Model):
    id_detalleventa = models.AutoField(db_column='ID_DetalleVenta', primary_key=True)  # Field name made lowercase.
    id_venta = models.ForeignKey('Venta', models.DO_NOTHING, db_column='ID_Venta')  # Field name made lowercase.
    id_producto = models.ForeignKey('Productos', models.DO_NOTHING, db_column='ID_Producto')  # Field name made lowercase.
    cantidad = models.IntegerField(db_column='Cantidad')  # Field name made lowercase.
    preciounitario = models.IntegerField(db_column='PrecioUnitario')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'DetalleVenta'

#personas (COPIADA)
class DeudaCliente(models.Model):
    id_deuda = models.AutoField(db_column='ID_Deuda', primary_key=True)  # Field name made lowercase.
    id_cliente = models.ForeignKey(Clientes, models.DO_NOTHING, db_column='ID_Cliente')  # Field name made lowercase.
    id_venta = models.ForeignKey('Venta', models.DO_NOTHING, db_column='ID_Venta')  # Field name made lowercase.
    fecha_abono = models.DateField(db_column='Fecha_Abono')  # Field name made lowercase.
    abono = models.DecimalField(db_column='Abono', max_digits=10, decimal_places=2)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Deuda_Cliente'

#ubicaciones(COPIADA)
class Direccion(models.Model):
    id_direccion = models.AutoField(db_column='ID_Direccion', primary_key=True)  # Field name made lowercase.
    id_departamento = models.ForeignKey(Departamento, models.DO_NOTHING, db_column='ID_Departamento')  # Field name made lowercase.
    direccion = models.CharField(db_column='Direccion', max_length=100, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Direccion'

#personas (COPIADA)
class Empleados(models.Model):
    id_empleado = models.AutoField(db_column='ID_Empleado', primary_key=True)  # Field name made lowercase.
    id_direccion = models.ForeignKey(Direccion, models.DO_NOTHING, db_column='ID_Direccion')  # Field name made lowercase.
    nombres = models.CharField(db_column='Nombres', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    apellidos = models.CharField(db_column='Apellidos', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    numerotelefonico = models.CharField(db_column='NumeroTelefonico', max_length=10, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    correoprofesional = models.CharField(db_column='CorreoProfesional', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.
    cargo = models.CharField(db_column='Cargo', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.
    fechainicio = models.DateField(db_column='FechaInicio', blank=True, null=True)  # Field name made lowercase.
    fechafin = models.DateField(db_column='FechaFin', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Empleados'

#ubicaciones (COPIADA)
class Municipio(models.Model):
    id_municipio = models.AutoField(db_column='ID_Municipio', primary_key=True)  # Field name made lowercase.
    id_departamento = models.ForeignKey(Departamento, models.DO_NOTHING, db_column='ID_Departamento')  # Field name made lowercase.
    municipio = models.CharField(db_column='Municipio', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Municipio'

#proveedores (COPIADA)
class Ofrece(models.Model):
    id_proveedor = models.ForeignKey('Proveedores', models.DO_NOTHING, db_column='ID_Proveedor')  # Field name made lowercase.
    id_productoproveedor = models.ForeignKey('Productoproveedor', models.DO_NOTHING, db_column='ID_ProductoProveedor')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Ofrece'

#proveedores (COPIADA)
class Productoproveedor(models.Model):
    id_productoproveedor = models.AutoField(db_column='ID_ProductoProveedor', primary_key=True)  # Field name made lowercase.
    id_producto = models.ForeignKey('Productos', models.DO_NOTHING, db_column='ID_Producto')  # Field name made lowercase.
    preciodecompra = models.DecimalField(db_column='PrecioDeCompra', max_digits=10, decimal_places=2)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'ProductoProveedor'

#productos (COPIADAS)
class Productos(models.Model):
    id_producto = models.AutoField(db_column='ID_Producto', primary_key=True)  # Field name made lowercase.
    id_categoria = models.ForeignKey(Categoria, models.DO_NOTHING, db_column='ID_Categoria')  # Field name made lowercase.
    id_talla = models.ForeignKey('Tallas', models.DO_NOTHING, db_column='ID_Talla')  # Field name made lowercase.
    nombre = models.CharField(db_column='Nombre', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.
    cantidadstock = models.IntegerField(db_column='CantidadStock', blank=True, null=True)  # Field name made lowercase.
    stock = models.IntegerField(db_column='Stock', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Productos'


#proveedores (COPIADA)
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

#producto (COPIADA)
class Tallas(models.Model):
    id_talla = models.AutoField(db_column='ID_Talla', primary_key=True)  # Field name made lowercase.
    talla = models.CharField(db_column='Talla', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Tallas'

#personas (CREADA)
class TipoCliente(models.Model):
    id_tipo_cliente = models.AutoField(db_column='ID_Tipo_Cliente', primary_key=True)  # Field name made lowercase.
    tipo = models.CharField(db_column='Tipo', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Tipo_Cliente'

#ventas (COPIADA)
class Venta(models.Model):
    id_venta = models.AutoField(db_column='ID_Venta', primary_key=True)  # Field name made lowercase.
    fechaventa = models.DateField(db_column='FechaVenta')  # Field name made lowercase.
    id_cliente = models.ForeignKey(Clientes, models.DO_NOTHING, db_column='ID_Cliente')  # Field name made lowercase.
    id_empleado = models.ForeignKey(Empleados, models.DO_NOTHING, db_column='ID_Empleado')  # Field name made lowercase.
    total = models.DecimalField(db_column='Total', max_digits=10, decimal_places=2)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Venta'
