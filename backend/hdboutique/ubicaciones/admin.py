from django.contrib import admin
from ubicaciones.models import Departamento, Direccion, Municipio

# Register your models here.
admin.site.register(Departamento)
admin.site.register(Direccion)
admin.site.register(Municipio)