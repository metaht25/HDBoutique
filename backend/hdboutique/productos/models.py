from django.db import models

#productos, categorias, tallas

class Productos(models.Model):
    id_producto = models.AutoField(db_column='ID_Producto', primary_key=True)  # Field name made lowercase.
    id_categoria = models.ForeignKey('Categoria', models.DO_NOTHING, db_column='ID_Categoria')  # Field name made lowercase.
    id_talla = models.ForeignKey('Tallas', models.DO_NOTHING, db_column='ID_Talla')  # Field name made lowercase.
    nombre = models.CharField(db_column='Nombre', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.
    cantidadstock = models.IntegerField(db_column='CantidadStock', blank=True, null=True)  # Field name made lowercase.
    stock = models.IntegerField(db_column='Stock', blank=True, null=True)  # Field name made lowercase.
    preciounitario = models.DecimalField(db_column='PrecioUnitario', max_digits=10, decimal_places=2, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'Productos'

class Categoria(models.Model):
    id_categoria = models.AutoField(db_column='ID_Categoria', primary_key=True)  # Field name made lowercase.
    categoria = models.CharField(db_column='Categoria', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Categoria'

class Tallas(models.Model):
    id_talla = models.AutoField(db_column='ID_Talla', primary_key=True)  # Field name made lowercase.
    talla = models.CharField(db_column='Talla', max_length=20, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Tallas'