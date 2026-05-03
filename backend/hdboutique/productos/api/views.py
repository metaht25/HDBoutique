from rest_framework import viewsets
from productos.models import Productos, Categoria, Tallas
from productos.api.serializers import (
    ProductosSerializer,
    CategoriaSerializer,
    TallasSerializer,
)


class ProductosViewSet(viewsets.ModelViewSet):
    queryset = Productos.objects.all()
    serializer_class = ProductosSerializer


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer


class TallasViewSet(viewsets.ModelViewSet):
    queryset = Tallas.objects.all()
    serializer_class = TallasSerializer