from rest_framework import viewsets
from compras.models import Compras, Detallecompra
from compras.api.serializers import (
    ComprasSerializer,
    DetallecompraSerializer,
)


class ComprasViewSet(viewsets.ModelViewSet):
    queryset = Compras.objects.all()
    serializer_class = ComprasSerializer


class DetallecompraViewSet(viewsets.ModelViewSet):
    queryset = Detallecompra.objects.all()
    serializer_class = DetallecompraSerializer