from django.contrib import admin
from productos.models import Productos, Categoria, Tallas

admin.site.register(Productos)
admin.site.register(Categoria)
admin.site.register(Tallas)