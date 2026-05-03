from django.contrib import admin
from proveedores.models import Proveedores, Ofrece, Productoproveedor


admin.site.register(Proveedores)
admin.site.register(Ofrece)
admin.site.register(Productoproveedor)