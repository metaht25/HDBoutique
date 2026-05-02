from django.db import models
#clientes, tipo_cliente, empleados, deuda cliente 

class Clientes(models.Model):
    id_cliente = models.AutoField(db_column='ID_Cliente', primary_key=True)  # Field name made lowercase.
    id_direccion = models.ForeignKey('ubicaciones.Direccion', models.DO_NOTHING, db_column='ID_Direccion') # Field name made lowercase.
    id_tipo_cliente = models.ForeignKey('TipoCliente', models.DO_NOTHING, db_column='ID_Tipo_Cliente')  # Field name made lowercase.
    nombres = models.CharField(db_column='Nombres', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    apellidos = models.CharField(db_column='Apellidos', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.
    numerotelefono = models.CharField(db_column='NumeroTelefono', max_length=10, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Clientes'

class TipoCliente(models.Model):
    id_tipo_cliente = models.AutoField(db_column='ID_Tipo_Cliente', primary_key=True)  # Field name made lowercase.
    tipo = models.CharField(db_column='Tipo', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Tipo_Cliente'

class Empleados(models.Model):
    id_empleado = models.AutoField(db_column='ID_Empleado', primary_key=True)  # Field name made lowercase.
    id_direccion = models.ForeignKey('ubicaciones.Direccion', models.DO_NOTHING, db_column='ID_Direccion')  # Field name made lowercase.
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

class DeudaCliente(models.Model):
    id_deuda = models.AutoField(db_column='ID_Deuda', primary_key=True)  # Field name made lowercase.
    id_cliente = models.ForeignKey(Clientes, models.DO_NOTHING, db_column='ID_Cliente')  # Field name made lowercase.
    id_venta = models.ForeignKey('ventas.Venta', models.DO_NOTHING, db_column='ID_Venta')  # Field name made lowercase.
    fecha_abono = models.DateField(db_column='Fecha_Abono')  # Field name made lowercase.
    abono = models.DecimalField(db_column='Abono', max_digits=10, decimal_places=2)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Deuda_Cliente'