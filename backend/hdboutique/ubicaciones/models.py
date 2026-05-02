from django.db import models
#Departamento, Municipio, direccion

class Departamento(models.Model):
    id_departamento = models.AutoField(db_column='ID_Departamento', primary_key=True)  # Field name made lowercase.
    departamento = models.CharField(db_column='Departamento', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS')  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Departamento'

class Direccion(models.Model):
    id_direccion = models.AutoField(db_column='ID_Direccion', primary_key=True)  # Field name made lowercase.
    id_departamento = models.ForeignKey(Departamento, models.DO_NOTHING, db_column='ID_Departamento')  # Field name made lowercase.
    direccion = models.CharField(db_column='Direccion', max_length=100, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Direccion'

class Municipio(models.Model):
    id_municipio = models.AutoField(db_column='ID_Municipio', primary_key=True)  # Field name made lowercase.
    id_departamento = models.ForeignKey(Departamento, models.DO_NOTHING, db_column='ID_Departamento')  # Field name made lowercase.
    municipio = models.CharField(db_column='Municipio', max_length=40, db_collation='SQL_Latin1_General_CP1_CI_AS', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'Municipio'
