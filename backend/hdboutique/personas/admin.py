from django.contrib import admin
from personas.models import Clientes,TipoCliente,Empleados,DeudaCliente

admin.site.register(Clientes)
admin.site.register(TipoCliente)
admin.site.register(Empleados)
admin.site.register(DeudaCliente)
